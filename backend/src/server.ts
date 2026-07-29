import { app } from './app';
import { config } from './config/env';
import { initDatabaseSchema } from './db/mysql';
import { setupWorker } from './queues/emailWorker';
import { reconcileOrphanedJobs } from './services/reconciliation';
import { getOrCreateSender } from './utils/ethereal';

async function startServer() {
  try {
    console.log('--- Initializing Email Job Scheduler Backend (Raw SQL MySQL) ---');

    await initDatabaseSchema();

    const defaultSender = await getOrCreateSender();
    console.log(`[Sender Ready] Default Sender ID: ${defaultSender.id}, Email: ${defaultSender.email}`);

    setupWorker();

    // Start server first
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
    });

    // Run reconciliation in background
    reconcileOrphanedJobs().catch((err) => {
      console.error("Reconciliation failed:", err);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();