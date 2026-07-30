import { Job } from 'bullmq';
import { EmailJobData, emailQueue } from '../queues/emailQueue';
import { query, queryOne } from '../db/mysql';
import { RateLimiterService } from '../services/rateLimiter';
import { sendEmail } from '../services/emailService';
import { config } from '../config/env';

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

  console.log("================================");
  console.log("[Worker] Processing", emailJobId);

  try {
    console.log("STEP-1 Loading DB");

    const dbRecord = await queryOne<any>(
      `SELECT se.*, s.name AS senderName, s.email AS senderEmail,
              s.smtpUser, s.smtpPass,
              u.name AS userName
       FROM scheduled_emails se
       JOIN senders s ON se.senderId = s.id
       JOIN users u ON se.userId = u.id
       WHERE se.id = ?`,
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

    console.log("STEP-7 Dispatching Email via sendEmail Service");

    const sendResult = await sendEmail({
      to: recipientEmail,
      subject,
      body,
      fromName: getDisplayName(dbRecord),
      fromEmail: dbRecord.senderEmail,
      smtpUser: dbRecord.smtpUser,
      smtpPass: dbRecord.smtpPass,
    });

    console.log(`STEP-8 Email Sent successfully (${sendResult.provider}). Message ID:`, sendResult.messageId);

    const previewUrl = sendResult.previewUrl || "";

    await query(
      `UPDATE scheduled_emails
       SET status='sent',
           sentAt=NOW(),
           previewUrl=?,
           attempts=?,
           errorMessage=NULL
       WHERE id=?`,
      [
        previewUrl,
        job.attemptsMade + 1,
        emailJobId,
      ]
    );

    console.log("STEP-9 scheduled_emails Updated");

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
          sendResult.messageId,
          previewUrl,
        ]
      );

      console.log("STEP-10 sent_emails Inserted");
    } catch (e: any) {
      console.log("History insert failed:", e.message);
    }

    console.log("EMAIL SENT SUCCESSFULLY");
  } catch (err: any) {
    console.error("EMAIL ERROR:", err);

    try {
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
    } catch (dbErr: any) {
      console.error("Failed to update DB:", dbErr.message);
    }

    throw err;
  }
}
