const app = require('./app');
const { ensureInitialized: initArticles } = require('./models/articleStore');
const { ensureInitialized: initLanguages } = require('./models/languageStore');
const { ensureInitialized: initLocations } = require('./models/locationStore');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Ensure all data stores are initialized before listening
    await Promise.all([
      initArticles(),
      initLanguages(),
      initLocations()
    ]);
    
    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize and start server:', err);
    process.exit(1);
  }
}

startServer();
