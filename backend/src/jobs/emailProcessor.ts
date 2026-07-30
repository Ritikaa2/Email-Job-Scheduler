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
    .trim();
}

function getDisplayName(record: any): string {
  return record.userName || record.senderName || 'ReachInbox.ai';
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const {
    emailJobId,
    senderId,
    recipientEmail,
    subject,
    body,
    maxEmailsPerHour,
    minDelayBetweenEmailsMs,
  } = job.data;

  console.log(`==============================`);
  console.log(`[Worker] Processing ${emailJobId}`);

  try {
    console.log("STEP-1 Loading DB");

    const dbRecord = await queryOne<any>(
      `SELECT se.*, s.name as senderName, s.email as senderEmail,
              s.smtpUser, s.smtpPass,
              u.name as userName
       FROM scheduled_emails se
       JOIN senders s ON se.senderId=s.id
       JOIN users u ON se.userId=u.id
       WHERE se.id=?`,
      [emailJobId]
    );

    console.log("STEP-2 DB Loaded");

    if (!dbRecord) {
      console.log("Email record not found");
      return;
    }

    if (dbRecord.status === "sent" || dbRecord.status === "cancelled") {
      console.log("Already processed");
      return;
    }

    console.log("STEP-3 Rate Limit");

    const rateCheck =
      await RateLimiterService.checkAndIncrementHourlyLimit(
        senderId,
        maxEmailsPerHour || config.maxEmailsPerHourPerSender
      );

    console.log("STEP-4 Rate Limit Done");

    if (!rateCheck.allowed) {
      const nextTime = new Date(
        Date.now() + (rateCheck.retryDelayMs || 3600000)
      );

      await query(
        `UPDATE scheduled_emails
         SET status='rescheduled',
             scheduledFor=?
         WHERE id=?`,
        [nextTime, emailJobId]
      );

      await emailQueue.add(
        "send-email",
        {
          ...job.data,
          scheduledFor: nextTime.toISOString(),
        },
        {
          delay: rateCheck.retryDelayMs || 3600000,
        }
      );

      console.log("Job Rescheduled");
      return;
    }

    console.log("STEP-5 Min Delay");

    await RateLimiterService.enforceMinDelay(
      senderId,
      minDelayBetweenEmailsMs || config.minDelayBetweenEmailsMs
    );

    console.log("STEP-6 Delay Complete");

    console.log("SMTP User:", dbRecord.smtpUser);
console.log("SMTP Host:", config.smtpHost);
console.log("SMTP Port:", config.smtpPort);
console.log("SMTP Secure:", config.smtpSecure);
console.log("SMTP Pass Length:", dbRecord.smtpPass?.length);

const transporter = createTransporter(
  dbRecord.smtpUser,
  dbRecord.smtpPass
);

    console.log("STEP-7 Transporter Created");

    // await transporter.verify();

    console.log("STEP-8 SMTP Verified");

    const info = await transporter.sendMail({
      from: `"${getDisplayName(dbRecord)}" <${dbRecord.senderEmail}>`,
      to: recipientEmail,
      subject,
      html: body,
      text: htmlToPlainText(body),
    });

    console.log("STEP-9 Email Sent");

    const previewToken = crypto.randomBytes(32).toString("hex");

    const previewUrl =
      nodemailer.getTestMessageUrl(info) ||
      `${config.backendUrl}/api/emails/preview/${previewToken}`;

    await query(
      `UPDATE scheduled_emails
       SET status='sent',
           sentAt=NOW(),
           previewUrl=?,
           previewToken=?,
           attempts=?,
           errorMessage=NULL
       WHERE id=?`,
      [
        previewUrl,
        previewToken,
        job.attemptsMade + 1,
        emailJobId,
      ]
    );

    console.log("STEP-10 DB Updated");

    try {
      await query(
        `INSERT INTO sent_emails
        (id,userId,senderId,recipientEmail,subject,body,sentAt,messageId,previewUrl,status)
        VALUES(?,?,?,?,?,?,NOW(),?,?,'sent')`,
        [
          emailJobId,
          dbRecord.userId,
          dbRecord.senderId,
          recipientEmail,
          subject,
          body,
          info.messageId,
          previewUrl,
        ]
      );
    } catch (e: any) {
      console.log("History insert failed:", e.message);
    }

    console.log("SUCCESS");
  } catch (err: any) {
    console.error("EMAIL ERROR:", err);

    await query(
      `UPDATE scheduled_emails
       SET status='failed',
           attempts=?,
           errorMessage=?
       WHERE id=?`,
      [
        job.attemptsMade + 1,
        err.message,
        emailJobId,
      ]
    );

    throw err;
  }
}
