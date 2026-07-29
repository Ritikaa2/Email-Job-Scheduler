import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import { AuthRequest } from '../middlewares/auth';
import { query, queryOne } from '../db/mysql';
import { emailQueue } from '../queues/emailQueue';
import { pingQueueStore, useMemoryQueue } from '../services/rateLimiter';
import { getOrCreateSender } from '../utils/ethereal';

type EmailStatusFilter = 'all' | 'scheduled' | 'sent' | 'failed' | 'cancelled';

const VALID_STATUS_FILTERS = new Set<EmailStatusFilter>(['all', 'scheduled', 'sent', 'failed', 'cancelled']);

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function normalizePage(value: unknown, fallback: number) {
  const parsed = parseInt(String(value || fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLimit(value: unknown, fallback: number) {
  const parsed = parseInt(String(value || fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

function normalizeStatusFilter(value: unknown): EmailStatusFilter {
  const normalized = String(value || 'all').toLowerCase() as EmailStatusFilter;
  return VALID_STATUS_FILTERS.has(normalized) ? normalized : 'all';
}

function getStatusesForFilter(status: EmailStatusFilter, defaultStatuses: string[]) {
  const requestedStatuses = status === 'all'
    ? defaultStatuses
    : status === 'scheduled'
      ? ['scheduled', 'rescheduled']
      : [status];

  return requestedStatuses.filter((requestedStatus) => defaultStatuses.includes(requestedStatus));
}

function buildEmailListFilters(userId: string, search: unknown, status: unknown, defaultStatuses: string[]) {
  const filters = ['userId = ?'];
  const params: any[] = [userId];
  const statuses = getStatusesForFilter(normalizeStatusFilter(status), defaultStatuses);

  if (statuses.length > 0) {
    filters.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  } else {
    filters.push('1 = 0');
  }

  const searchTerm = String(search || '').trim();
  if (searchTerm) {
    const likeTerm = `%${searchTerm}%`;
    filters.push('(recipientEmail LIKE ? OR subject LIKE ?)');
    params.push(likeTerm, likeTerm);
  }

  return {
    whereSql: filters.join(' AND '),
    params,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class EmailController {
  /**
   * GET /api/emails/preview/:token
   */
  static async previewByToken(req: Request, res: Response) {
    const token = String(req.params.token || '').trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(404).send('Email preview was not found.');
    }

    const email = await queryOne<any>(
      `SELECT recipientEmail, subject, body, sentAt, status
       FROM scheduled_emails
       WHERE previewToken = ? AND status = 'sent'
       LIMIT 1`,
      [token]
    );

    if (!email) {
      return res.status(404).send('Email preview was not found.');
    }

    res.type('html').send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(email.subject)}</title>
          <style>
            body { margin: 0; background: #f4f6ff; color: #172033; font-family: Inter, Arial, sans-serif; }
            main { max-width: 760px; margin: 0 auto; padding: 32px 16px; }
            .shell { overflow: hidden; border: 1px solid #dde5f2; border-radius: 12px; background: #fff; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.10); }
            .header { padding: 24px 28px; border-bottom: 1px solid #e2e8f0; }
            .label { margin: 0 0 8px; color: #6d28d9; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
            h1 { margin: 0; font-size: 26px; line-height: 1.25; }
            .meta { margin-top: 10px; color: #64748b; font-size: 13px; }
            .body { padding: 28px; font-size: 15px; line-height: 1.75; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <main>
            <article class="shell">
              <div class="header">
                <p class="label">Email Preview</p>
                <h1>${escapeHtml(email.subject)}</h1>
                <div class="meta">To ${escapeHtml(email.recipientEmail)}${email.sentAt ? ` · Sent ${escapeHtml(new Date(email.sentAt).toLocaleString())}` : ''}</div>
              </div>
              <div class="body">${String(email.body || '').replace(/\n/g, '<br/>')}</div>
            </article>
          </main>
        </body>
      </html>
    `);
  }

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
        Promise.resolve(emailQueue.waitUntilReady()).then(() => undefined),
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
          const job = await withTimeout<any>(
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
            `UPDATE scheduled_emails
SET status = 'failed', attempts = 0, errorMessage = ?
WHERE id = ?`,
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
    const page = normalizePage(req.query.page, 1);
    const limit = normalizeLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;
    const filters = buildEmailListFilters(
      userId,
      req.query.search,
      req.query.status,
      ['scheduled', 'rescheduled', 'cancelled']
    );

    const [emails, countRow] = await Promise.all([
      query(
        `SELECT * FROM scheduled_emails 
         WHERE ${filters.whereSql} 
         ORDER BY scheduledFor ASC LIMIT ? OFFSET ?`,
        [...filters.params, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as total FROM scheduled_emails 
         WHERE ${filters.whereSql}`,
        filters.params
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
   * POST /api/emails/:id/cancel
   */
  static async cancelScheduled(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const emailId = req.params.id;

    try {
      const scheduledEmail = await queryOne<any>(
        `SELECT id, recipientEmail, subject, status, bullJobId
         FROM scheduled_emails
         WHERE id = ? AND userId = ?
         LIMIT 1`,
        [emailId, userId]
      );

      if (!scheduledEmail) {
        return res.status(404).json({ error: 'Scheduled email was not found.' });
      }

      if (scheduledEmail.status !== 'scheduled') {
        return res.status(409).json({ error: 'Only emails with scheduled status can be cancelled.' });
      }

      if (scheduledEmail.bullJobId) {
        const queuedJob = await (emailQueue as any).getJob(scheduledEmail.bullJobId);

        if (queuedJob) {
          try {
            await queuedJob.remove();
          } catch (error: any) {
            return res.status(409).json({
              error: error.message || 'This email is already being processed and cannot be cancelled.',
            });
          }
        }
      }

      const updateResult = await query<any>(
        `UPDATE scheduled_emails
SET status = 'cancelled', errorMessage = NULL
WHERE id = ? AND userId = ? AND status = 'scheduled'`,
        [emailId, userId]
      );

      const affectedRows = (updateResult as any).affectedRows || 0;
      if (affectedRows === 0) {
        return res.status(409).json({ error: 'This email could not be cancelled because its status changed.' });
      }

      await query(
        `UPDATE email_jobs
         SET status = 'cancelled'
         WHERE scheduledEmailId = ?`,
        [emailId]
      );

      return res.json({
        message: `Cancelled scheduled email to ${scheduledEmail.recipientEmail}.`,
        data: {
          ...scheduledEmail,
          status: 'cancelled',
        },
      });
    } catch (error: any) {
      console.error('Cancel scheduled email error:', error);
      return res.status(500).json({ error: error.message || 'Failed to cancel scheduled email.' });
    }
  }

  /**
   * GET /api/emails/sent?page=&limit= via Raw SQL
   */
  static async getSent(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const page = normalizePage(req.query.page, 1);
    const limit = normalizeLimit(req.query.limit, 10);
    const offset = (page - 1) * limit;
    const filters = buildEmailListFilters(
      userId,
      req.query.search,
      req.query.status,
      ['sent', 'failed']
    );

    const [emails, countRow] = await Promise.all([
      query(
        `SELECT * FROM scheduled_emails 
         WHERE ${filters.whereSql} 
         ORDER BY COALESCE(sentAt, createdAt) DESC LIMIT ? OFFSET ?`,
        [...filters.params, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as total FROM scheduled_emails 
         WHERE ${filters.whereSql}`,
        filters.params
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
        withTimeout(pingQueueStore(), 3000, 'Queue store ping timed out'),
      ]);

      res.json({
        healthy: redisPong === 'PONG' || redisPong === 'MEMORY',
        mode: useMemoryQueue ? 'memory' : 'redis',
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
   * GET /api/emails/recent-activity
   */
  static async getRecentActivity(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const activities = await query(
      `SELECT
          id,
          recipientEmail,
          subject,
          status,
          CASE
            WHEN status = 'sent' THEN 'Email Sent'
            WHEN status = 'failed' THEN 'Email Failed'
            WHEN status = 'cancelled' THEN 'Email Cancelled'
            ELSE 'Email Scheduled'
          END AS action,
          COALESCE(sentAt, createdAt) AS occurredAt
       FROM scheduled_emails
       WHERE userId = ?
       ORDER BY COALESCE(sentAt, createdAt) DESC
       LIMIT 10`,
      [userId]
    );

    res.json({ data: activities });
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

      if (uniqueEmails.length === 0) {
        return res.status(400).json({ error: 'No valid email addresses were found in this file.' });
      }

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
