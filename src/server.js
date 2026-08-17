const app = require('./app');
const { ensureInitialized } = require('./models/articleStore');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Ensure the articles data store is initialized before listening
    await ensureInitialized();
    
    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize and start server:', err);
    process.exit(1);
  }
}

startServer();
