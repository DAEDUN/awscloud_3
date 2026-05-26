import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase } from './schema.js';

const port = Number(process.env.PORT || 3000);
const dbInitRetryIntervalMs = Number(process.env.DB_INIT_RETRY_INTERVAL_MS || 30000);

async function initializeDatabaseWithRetry() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Database initialization failed. API routes that use the database may fail until it is reachable.');
    console.error(error.message);

    if (dbInitRetryIntervalMs > 0) {
      const retryTimer = setTimeout(initializeDatabaseWithRetry, dbInitRetryIntervalMs);
      retryTimer.unref();
    }
  }
}

createApp().listen(port, () => {
  console.log(`Study room app listening on http://localhost:${port}`);
  initializeDatabaseWithRetry();
});
