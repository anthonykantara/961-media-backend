const app = require('./app');
const { ensureInitialized: initArticles } = require('./models/articleStore');
const { ensureInitialized: initLanguages } = require('./models/languageStore');
const { ensureInitialized: initLocations } = require('./models/locationStore');
const { runMigrations } = require('./db');
const { startQueueWorker } = require('./workers/queueProcessor');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Run database migrations and ensure all data stores are initialized
    await runMigrations();
    await Promise.all([
      initArticles(),
      initLanguages(),
      initLocations()
    ]);
    
    // Start background queue processing worker
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
