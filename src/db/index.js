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
  const activePool = getPool();
  if (!activePool) {
    return null;
  }
  return await activePool.query(text, params);
}

async function runMigrations() {
  const activePool = getPool();
  if (!activePool) {
    return false;
  }
  try {
    const migrationPath = path.join(__dirname, '../../migrations/001_create_content_pipeline.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    await activePool.query(sql);
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
