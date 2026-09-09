const { runMigrations, closePool } = require('./db');

async function main() {
  try {
    const migrated = await runMigrations();
    if (!migrated) {
      throw new Error('Database migrations could not be completed. Check database configuration and connectivity.');
    }

    console.log('Database migrations completed successfully.');
  } catch (err) {
    console.error('Database migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
