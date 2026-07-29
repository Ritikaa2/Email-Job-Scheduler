import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import { AuthRequest } from '../middlewares/auth';
import { query, queryOne } from '../db/mysql';
import { emailQueue } from '../queues/emailQueue';
import { redisClient } from '../services/rateLimiter';
import { getOrCreateSender } from '../utils/ethereal';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export class EmailController {
  /**
   * POST /api/emails/schedule via Raw SQL
   */
  static async schedule(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmailsMs = 1000,
      maxEmailsPerHour = 100,
      senderId,
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list must not be empty.' });
    }

    const normalizedRecipients = Array.from(
      new Set(
        recipients
          .map((recipient: string) => recipient.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (normalizedRecipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list must contain valid email addresses.' });
    }

    const startMs = new Date(startTime).getTime();
    if (Number.isNaN(startMs)) {
      return res.status(400).json({ error: 'Please choose a valid schedule date and time.' });
    }

    try {
      await withTimeout(
        emailQueue.waitUntilReady(),
        5000,
        'Email queue is not ready. Please start Redis, then restart the backend server.'
      );
    } catch (error: any) {
      return res.status(503).json({ error: error.message || 'Email queue is not ready.' });
    }

    const sender = await getOrCreateSender(senderId);
    const nowMs = Date.now();
    const createdRecords = [];

    try {
      for (let i = 0; i < normalizedRecipients.length; i++) {
        const recipientEmail = normalizedRecipients[i];
        const scheduledTime = new Date(startMs + i * delayBetweenEmailsMs);
        const delay = Math.max(0, scheduledTime.getTime() - nowMs);
        const emailJobId = uuidv4();

        await query(
          `INSERT INTO scheduled_emails (id, userId, senderId, recipientEmail, subject, body, scheduledFor, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW())`,
          [emailJobId, userId, sender.id, recipientEmail, subject, body, scheduledTime]
        );

        try {
          const job = await withTimeout(
            emailQueue.add(
              'send-email',
              {
                emailJobId,
                userId,
                senderId: sender.id,
                recipientEmail,
                subject,
                body,
                scheduledFor: scheduledTime.toISOString(),
                minDelayBetweenEmailsMs: delayBetweenEmailsMs,
                maxEmailsPerHour,
              },
              {
                delay,
                jobId: `job-${emailJobId}`,
              }
            ),
            5000,
            'Email queue did not accept the job in time. Check Redis and worker logs.'
          );

          await query('UPDATE scheduled_emails SET bullJobId = ? WHERE id = ?', [job.id, emailJobId]);

          createdRecords.push({
            id: emailJobId,
            recipientEmail,
            scheduledFor: scheduledTime,
            status: 'scheduled',
            bullJobId: job.id,
          });
        } catch (error: any) {
          await query(
            `UPDATE scheduled_emails SET status = 'failed', attempts = 0, errorMessage = ? WHERE id = ?`,
            [error.message || 'Queue enqueue failed', emailJobId]
          );
          throw error;
        }
      }

      return res.status(201).json({
        message: `Successfully scheduled ${createdRecords.length} email(s).`,
        count: createdRecords.length,
        data: createdRecords,
      });
    } catch (error: any) {
      console.error('Schedule email error:', error);
      return res.status(503).json({
        error: error.message || 'Failed to schedule emails. Please check Redis and backend worker.',
      });
    }
  }

  /**
   * GET /api/emails/scheduled?page=&limit= via Raw SQL
   */
  static async getScheduled(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const offset = (page - 1) * limit;

    const [emails, countRow] = await Promise.all([
      query(
        `SELECT * FROM scheduled_emails 
         WHERE userId = ? AND status IN ('scheduled', 'rescheduled') 
         ORDER BY scheduledFor ASC LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as total FROM scheduled_emails 
         WHERE userId = ? AND status IN ('scheduled', 'rescheduled')`,
        [userId]
      ),
    ]);

    const total = countRow?.total || 0;

    res.json({
      data: emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * GET /api/emails/sent?page=&limit= via Raw SQL
   */
  static async getSent(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const offset = (page - 1) * limit;

    const [emails, countRow] = await Promise.all([
      query(
        `SELECT * FROM scheduled_emails 
         WHERE userId = ? AND status IN ('sent', 'failed') 
         ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as total FROM scheduled_emails 
         WHERE userId = ? AND status IN ('sent', 'failed')`,
        [userId]
      ),
    ]);

    const total = countRow?.total || 0;

    res.json({
      data: emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * GET /api/emails/queue-status
   */
  static async getQueueStatus(req: AuthRequest, res: Response) {
    try {
      const [counts, redisPong] = await Promise.all([
        emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed', 'paused'),
        withTimeout(redisClient.ping(), 3000, 'Redis ping timed out'),
      ]);

      res.json({
        healthy: redisPong === 'PONG',
        redis: redisPong,
        counts,
        checkedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(503).json({
        healthy: false,
        error: error.message || 'Queue status unavailable',
        checkedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/emails/upload-recipients
   */
  static async uploadRecipients(req: AuthRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const content = req.file.buffer.toString('utf-8');
      let emails: string[] = [];

      if (req.file.originalname.endsWith('.csv')) {
        const records = parse(content, {
          skip_empty_lines: true,
          trim: true,
        });

        for (const row of records) {
          for (const cell of row) {
            if (typeof cell === 'string' && cell.includes('@')) {
              emails.push(cell.trim());
            }
          }
        }
      } else {
        const matches = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (matches) {
          emails = matches;
        }
      }

      const uniqueEmails = Array.from(new Set(emails));

      res.json({
        count: uniqueEmails.length,
        previewEmails: uniqueEmails.slice(0, 10),
        allEmails: uniqueEmails,
      });
    } catch (error: any) {
      res.status(400).json({ error: `Failed to parse file: ${error.message}` });
    }
  }
}
