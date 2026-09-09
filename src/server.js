// Initialize process-wide Sharp limits before the application loads any image-processing modules.
require('./services/imageRuntime');

const app = require('./app');
const { ensureInitialized: initArticles } = require('./models/articleStore');
const { ensureInitialized: initLanguages } = require('./models/languageStore');
const { ensureInitialized: initLocations } = require('./models/locationStore');
const { runDataMigration } = require('./workers/dataMigrationWorker');
const { startQueueWorker } = require('./workers/queueProcessor');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Database schema migrations run explicitly via `npm run migrate` during deployment,
    // rather than on every application restart.
    await runDataMigration();
    await Promise.all([
      initArticles(),
      initLanguages(),
      initLocations()
    ]);
    
    // Start background queue processing worker.
    // Publish/dispatch endpoints also trigger immediate processing, so the poller is primarily
    // a recovery/safety net rather than the primary trigger for new work.
    startQueueWorker();

    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize and start server:', err);
    process.exit(1);
  }
}

startServer();
