import { Job } from 'bullmq';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { EmailJobData, emailQueue } from '../queues/emailQueue';
import { query, queryOne } from '../db/mysql';
import { RateLimiterService } from '../services/rateLimiter';
import { createTransporter } from '../utils/ethereal';
import { config } from '../config/env';

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDisplayName(record: any): string {
  return record.userName || record.senderName || 'ReachInbox.ai';
}

function buildEmailHtml(subject: string, body: string, senderName: string): string {
  const safeSubject = escapeHtml(subject);
  const safeSenderName = escapeHtml(senderName);

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#172033">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px">
        <div style="overflow:hidden;border-radius:18px;background:#ffffff;border:1px solid #dde5f2;box-shadow:0 18px 48px rgba(15,23,42,0.10)">
          <div style="padding:26px 30px;background:linear-gradient(135deg,#4f46e5,#2563eb 56%,#0891b2);color:#ffffff">
            <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#dbeafe">ReachInbox.ai</div>
            <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2;font-weight:800">${safeSubject}</h1>
            <p style="margin:0;color:#e0f2fe;font-size:14px;line-height:1.6">Message from ${safeSenderName}</p>
          </div>

          <div style="padding:30px">
            <div style="font-size:15px;line-height:1.75;color:#1f2937">
              ${body.replace(/\n/g, '<br/>')}
            </div>
          </div>

          <div style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">
              Sent by ${safeSenderName} using ReachInbox.ai.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailJobId, senderId, recipientEmail, subject, body, maxEmailsPerHour, minDelayBetweenEmailsMs } = job.data;

  console.log(`[Worker] Processing email job ${job.id} (DB ID: ${emailJobId}) for ${recipientEmail}`);

  // 1. Idempotency & DB status check via Raw SQL
  const dbRecord = await queryOne<any>(
    `SELECT se.*, s.name as senderName, s.email as senderEmail, s.smtpUser, s.smtpPass, u.name as userName
     FROM scheduled_emails se 
     JOIN senders s ON se.senderId = s.id 
     JOIN users u ON se.userId = u.id
     WHERE se.id = ?`,
    [emailJobId]
  );

  if (!dbRecord) {
    console.warn(`[Worker] Record ${emailJobId} not found in DB. Skipping.`);
    return;
  }

  if (dbRecord.status === 'sent' || dbRecord.status === 'cancelled') {
    console.log(`[Worker] Email ${emailJobId} is already ${dbRecord.status}. Skipping.`);
    return;
  }

  // 2. Hourly rate limit check
  const maxLimit = maxEmailsPerHour || config.maxEmailsPerHourPerSender;
  const rateCheck = await RateLimiterService.checkAndIncrementHourlyLimit(senderId, maxLimit);

  if (!rateCheck.allowed) {
    console.warn(`[Worker] Rate limit exceeded for sender ${senderId}. Rescheduling job ${emailJobId} for next hour.`);

    const delayMs = rateCheck.retryDelayMs || 3600000;
    const newScheduledFor = new Date(Date.now() + delayMs);

    // Update DB status via Raw SQL
    await query(
      `UPDATE scheduled_emails SET status = 'rescheduled', scheduledFor = ?, updatedAt = NOW() WHERE id = ?`,
      [newScheduledFor, emailJobId]
    );

    // Enqueue a new delayed job
    const newJob = await emailQueue.add(
      'send-email',
      {
        ...job.data,
        scheduledFor: newScheduledFor.toISOString(),
      },
      {
        delay: delayMs,
        jobId: `rescheduled-${emailJobId}-${Date.now()}`,
      }
    );

    // Update DB bullJobId via Raw SQL
    await query(`UPDATE scheduled_emails SET bullJobId = ? WHERE id = ?`, [newJob.id, emailJobId]);

    return;
  }

  // 3. Minimum delay check
  const minDelay = minDelayBetweenEmailsMs || config.minDelayBetweenEmailsMs;
  await RateLimiterService.enforceMinDelay(senderId, minDelay);

  // 4. Send email via Nodemailer (Ethereal)
  try {
    const transporter = createTransporter(dbRecord.smtpUser, dbRecord.smtpPass);
    const senderName = getDisplayName(dbRecord);
    const emailHtml = buildEmailHtml(subject, body, senderName);

    const info = await transporter.sendMail({
      from: `"${senderName}" <${dbRecord.senderEmail}>`,
      to: recipientEmail,
      subject: subject,
      html: emailHtml,
      text: htmlToPlainText(body),
    });

    const previewToken = crypto.randomBytes(32).toString('hex');
    const etherealPreviewUrl = nodemailer.getTestMessageUrl(info);
    const previewUrl = etherealPreviewUrl ? String(etherealPreviewUrl) : `${config.backendUrl}/api/emails/preview/${previewToken}`;
    console.log(`[Worker] Email sent successfully to ${recipientEmail}! Preview URL: ${previewUrl}`);

    // Update DB on success via Raw SQL
    await query(
      `UPDATE scheduled_emails 
       SET status = 'sent', sentAt = NOW(), previewUrl = ?, previewToken = ?, attempts = ?, errorMessage = NULL, updatedAt = NOW() 
       WHERE id = ?`,
      [previewUrl, previewToken, job.attemptsMade + 1, emailJobId]
    );

    // Insert into sent_emails history table
    try {
      await query(
        `INSERT INTO sent_emails (id, userId, senderId, recipientEmail, subject, body, sentAt, messageId, previewUrl, status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'sent')`,
        [
          emailJobId, // reuse id for traceability
          dbRecord.userId,
          dbRecord.senderId,
          recipientEmail,
          subject,
          body,
          info.messageId || null,
          previewUrl,
        ]
      );
    } catch (err: any) {
      console.warn('[Worker] Failed to insert sent_emails history:', err?.message || err);
    }
  } catch (error: any) {
    console.error(`[Worker] Failed to send email ${emailJobId}:`, error.message);

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);
    const newStatus = isFinalAttempt ? 'failed' : dbRecord.status;

    await query(
      `UPDATE scheduled_emails SET status = ?, attempts = ?, errorMessage = ?, updatedAt = NOW() WHERE id = ?`,
      [newStatus, job.attemptsMade + 1, error.message, emailJobId]
    );

    throw error;
  }
}
