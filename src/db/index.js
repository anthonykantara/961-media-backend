const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

let pool = null;

function getPool() {
  if (!pool && (process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE)) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

async function query(text, params) {
  const activePool = module.exports.getPool();
  if (!activePool) {
    return null;
  }
  return await activePool.query(text, params);
}

async function runMigrations() {
  const activePool = module.exports.getPool();
  if (!activePool) {
    return false;
  }
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    for (const file of sqlFiles) {
      const checkRes = await activePool.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1;',
        [file]
      );
      if (checkRes && checkRes.rows && checkRes.rows.length > 0) {
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await activePool.query(sql);
      await activePool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING;',
        [file]
      );
    }
    return true;
  } catch (err) {
    console.error('Migration execution failed:', err.message);
    return false;
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  runMigrations,
  closePool
};
