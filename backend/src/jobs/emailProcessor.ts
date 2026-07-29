import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { EmailJobData, emailQueue } from '../queues/emailQueue';
import { query, queryOne } from '../db/mysql';
import { RateLimiterService } from '../services/rateLimiter';
import { createTransporter } from '../utils/ethereal';
import { config } from '../config/env';

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailJobId, senderId, recipientEmail, subject, body, maxEmailsPerHour, minDelayBetweenEmailsMs } = job.data;

  console.log(`[Worker] Processing email job ${job.id} (DB ID: ${emailJobId}) for ${recipientEmail}`);

  // 1. Idempotency & DB status check via Raw SQL
  const dbRecord = await queryOne<any>(
    `SELECT se.*, s.name as senderName, s.email as senderEmail, s.smtpUser, s.smtpPass 
     FROM scheduled_emails se 
     JOIN senders s ON se.senderId = s.id 
     WHERE se.id = ?`,
    [emailJobId]
  );

  if (!dbRecord) {
    console.warn(`[Worker] Record ${emailJobId} not found in DB. Skipping.`);
    return;
  }

  if (dbRecord.status === 'sent') {
    console.log(`[Worker] Email ${emailJobId} already sent. Skipping.`);
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
      `UPDATE scheduled_emails SET status = 'rescheduled', scheduledFor = ? WHERE id = ?`,
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

    const info = await transporter.sendMail({
      from: `"${dbRecord.senderName}" <${dbRecord.senderEmail}>`,
      to: recipientEmail,
      subject: subject,
      html: body.replace(/\n/g, '<br/>'),
      text: body,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    console.log(`[Worker] Email sent successfully to ${recipientEmail}! Preview URL: ${previewUrl}`);

    // Update DB on success via Raw SQL
    await query(
      `UPDATE scheduled_emails 
       SET status = 'sent', sentAt = NOW(), previewUrl = ?, attempts = ?, errorMessage = NULL 
       WHERE id = ?`,
      [previewUrl ? String(previewUrl) : null, job.attemptsMade + 1, emailJobId]
    );
  } catch (error: any) {
    console.error(`[Worker] Failed to send email ${emailJobId}:`, error.message);

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);
    const newStatus = isFinalAttempt ? 'failed' : dbRecord.status;

    await query(
      `UPDATE scheduled_emails SET status = ?, attempts = ?, errorMessage = ? WHERE id = ?`,
      [newStatus, job.attemptsMade + 1, error.message, emailJobId]
    );

    throw error;
  }
}
