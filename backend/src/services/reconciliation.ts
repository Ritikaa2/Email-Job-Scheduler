import { query } from '../db/mysql';
import { emailQueue } from '../queues/emailQueue';

export async function reconcileOrphanedJobs(): Promise<void> {
  console.log('[Reconciliation] Starting startup reconciliation check via Raw SQL...');

  try {
    // 1. Fetch all DB rows with status "scheduled" or "rescheduled" via Raw SQL
    const scheduledRecords = await query<any>(
      `SELECT * FROM scheduled_emails WHERE status IN ('scheduled', 'rescheduled')`
    );

    if (scheduledRecords.length === 0) {
      console.log('[Reconciliation] No scheduled/rescheduled emails found in DB.');
      return;
    }

    console.log(`[Reconciliation] Found ${scheduledRecords.length} pending records in DB. Verifying with Queue...`);

    const activeJobs = await emailQueue.getJobs(['delayed', 'waiting', 'active', 'paused']);
    const existingJobIds = new Set(activeJobs.map((j) => j.id));

    let reconciledCount = 0;

    for (const record of scheduledRecords) {
      const isJobInQueue = record.bullJobId && existingJobIds.has(record.bullJobId);

      if (!isJobInQueue) {
        console.log(`[Reconciliation] Orphaned record found: ID ${record.id} (bullJobId: ${record.bullJobId}). Re-enqueuing...`);

        const now = new Date().getTime();
        const scheduledTime = new Date(record.scheduledFor).getTime();
        const delay = Math.max(0, scheduledTime - now);

        const newJob = await emailQueue.add(
          'send-email',
          {
            emailJobId: record.id,
            userId: record.userId,
            senderId: record.senderId,
            recipientEmail: record.recipientEmail,
            subject: record.subject,
            body: record.body,
            scheduledFor: new Date(record.scheduledFor).toISOString(),
          },
          {
            delay,
            jobId: `reconciled-${record.id}-${Date.now()}`,
          }
        );

        // Update DB record with new BullMQ job ID via Raw SQL
        await query('UPDATE scheduled_emails SET bullJobId = ? WHERE id = ?', [newJob.id, record.id]);

        reconciledCount++;
      }
    }

    console.log(`[Reconciliation] Complete. Reconciled ${reconciledCount} orphaned jobs.`);
  } catch (error) {
    console.error('[Reconciliation] Error during reconciliation:', error);
  }
}
