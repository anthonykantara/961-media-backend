const crypto = require('crypto');
const db = require('../db');

// In-memory queue store for local/testing fallback when DB pool is unavailable
let memoryQueue = [];

/**
 * Normalizes task record output to consistent object structure
 */
function normalizeTaskRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    article_id: row.article_id,
    articleId: row.article_id,
    task_type: row.task_type || row.taskType || 'dispatch_all',
    options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {}),
    status: row.status,
    attempts: typeof row.attempts === 'number' ? row.attempts : parseInt(row.attempts || '0', 10),
    max_attempts: typeof row.max_attempts === 'number' ? row.max_attempts : parseInt(row.max_attempts || '5', 10),
    maxAttempts: typeof row.max_attempts === 'number' ? row.max_attempts : parseInt(row.max_attempts || '5', 10),
    last_error: row.last_error || null,
    next_run_at: row.next_run_at ? new Date(row.next_run_at).toISOString() : new Date().toISOString(),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    results: typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || {})
  };
}

/**
 * Enqueues a new dispatch task into database queue (or in-memory store)
 * 
 * @param {object} params Task creation parameters
 * @returns {Promise<object>} Created task record
 */
async function enqueueTask({
  articleId,
  taskType = 'dispatch_all',
  options = {},
  maxAttempts = 5,
  nextRunAt,
  publishAt,
  scheduledAt,
  next_run_at
}) {
  const pool = db.getPool();
  const id = crypto.randomUUID();
  const now = new Date();

  // Extract scheduling target date if provided
  const targetTime = nextRunAt || publishAt || scheduledAt || next_run_at ||
    (options && (options.nextRunAt || options.publishAt || options.scheduledAt || options.next_run_at));

  let runAtDate = now;
  if (targetTime) {
    let parsedTs = typeof targetTime === 'number' ? targetTime : new Date(targetTime).getTime();
    if (typeof targetTime === 'number' && targetTime < 1e11) {
      parsedTs = targetTime * 1000;
    } else if (typeof targetTime === 'string' && /^\d+$/.test(targetTime)) {
      const num = Number(targetTime);
      parsedTs = num < 1e11 ? num * 1000 : num;
    }
    if (!isNaN(parsedTs)) {
      runAtDate = new Date(parsedTs);
    }
  }

  // Separate internal control parameters from payload options
  const cleanOptions = { ...(options || {}) };
  delete cleanOptions.nextRunAt;
  delete cleanOptions.publishAt;
  delete cleanOptions.scheduledAt;
  delete cleanOptions.next_run_at;

  if (pool) {
    try {
      const sql = `
        INSERT INTO dispatch_queue (id, article_id, task_type, options, status, attempts, max_attempts, next_run_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'pending', 0, $5, $6, $7, $7)
        RETURNING *;
      `;
      const res = await pool.query(sql, [id, String(articleId), taskType, JSON.stringify(cleanOptions), maxAttempts, runAtDate, now]);
      if (res && res.rows && res.rows[0]) {
        return normalizeTaskRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database task enqueue error, using fallback:', err.message);
    }
  }

  // Fallback in-memory task record
  const task = {
    id,
    article_id: String(articleId),
    articleId: String(articleId),
    task_type: taskType,
    options: cleanOptions,
    status: 'pending',
    attempts: 0,
    max_attempts: maxAttempts,
    maxAttempts,
    last_error: null,
    next_run_at: runAtDate.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    results: {}
  };

  memoryQueue.push(task);
  return normalizeTaskRecord(task);
}

/**
 * Claims pending or scheduled retry tasks ready for execution.
 * 
 * @param {number} [limit=10] Maximum tasks to claim.
 * @returns {Promise<Array<object>>} Claimed task records.
 */
async function claimPendingTasks(limit = 10) {
  const pool = db.getPool();
  const now = new Date();

  if (pool) {
    try {
      const sql = `
        WITH ready_tasks AS (
          SELECT id FROM dispatch_queue
          WHERE status IN ('pending', 'retry_scheduled')
            AND next_run_at <= $1
            AND attempts < max_attempts
          ORDER BY created_at ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        UPDATE dispatch_queue q
        SET status = 'processing',
            attempts = q.attempts + 1,
            updated_at = $1
        FROM ready_tasks rt
        WHERE q.id = rt.id
        RETURNING q.*;
      `;
      const updateRes = await pool.query(sql, [now, limit]);
      if (updateRes && updateRes.rows) {
        return updateRes.rows.map(normalizeTaskRecord);
      }
      return [];
    } catch (err) {
      console.error('Database claim tasks error, using fallback:', err.message);
    }
  }

  // Fallback in-memory claiming
  const nowTs = now.getTime();
  const claimed = [];

  for (const task of memoryQueue) {
    if (claimed.length >= limit) break;
    const isReady = (task.status === 'pending' || task.status === 'retry_scheduled') &&
      new Date(task.next_run_at).getTime() <= nowTs &&
      task.attempts < task.max_attempts;

    if (isReady) {
      task.status = 'processing';
      task.attempts += 1;
      task.updated_at = now.toISOString();
      claimed.push(normalizeTaskRecord(task));
    }
  }

  return claimed;
}

/**
 * Marks a task as completed successfully.
 * 
 * @param {string} taskId Task ID
 * @param {object} [results={}] Results data
 * @returns {Promise<object|null>} Updated task
 */
async function markTaskComplete(taskId, results = {}) {
  const pool = db.getPool();
  const now = new Date();

  if (pool) {
    try {
      const sql = `
        UPDATE dispatch_queue
        SET status = 'completed',
            results = $1,
            updated_at = $2
        WHERE id = $3
        RETURNING *;
      `;
      const res = await pool.query(sql, [JSON.stringify(results), now, taskId]);
      if (res && res.rows && res.rows[0]) {
        return normalizeTaskRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database markTaskComplete error, using fallback:', err.message);
    }
  }

  const task = memoryQueue.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    task.results = results || {};
    task.updated_at = now.toISOString();
    return normalizeTaskRecord(task);
  }
  return null;
}

/**
 * Marks a task as failed and schedules an exponential retry or sets status to failed.
 * 
 * @param {string} taskId Task ID
 * @param {Error|string} error Error object or string
 * @param {number} currentAttempts Current attempt count
 * @param {number} maxAttempts Maximum allowed attempts
 * @param {object} [options={}] Additional configuration options (e.g. initialDelayMs)
 * @returns {Promise<object|null>} Updated task
 */
async function markTaskFailed(taskId, error, currentAttempts, maxAttempts, options = {}) {
  const pool = db.getPool();
  const now = new Date();
  const errMsg = error && error.message ? error.message : String(error || 'Unknown error');

  const attemptsCount = typeof currentAttempts === 'number' ? currentAttempts : 1;
  const maxAllowed = typeof maxAttempts === 'number' ? maxAttempts : 5;

  const isRetryable = attemptsCount < maxAllowed;
  const initialDelay = options.initialDelayMs || 1000;
  // Exponential backoff: initialDelay * 2^(attempts - 1)
  const backoffMs = isRetryable ? initialDelay * Math.pow(2, attemptsCount - 1) : 0;
  const nextRunAt = isRetryable ? new Date(now.getTime() + backoffMs) : now;
  const newStatus = isRetryable ? 'retry_scheduled' : 'failed';

  if (pool) {
    try {
      const sql = `
        UPDATE dispatch_queue
        SET status = $1,
            last_error = $2,
            next_run_at = $3,
            updated_at = $4
        WHERE id = $5
        RETURNING *;
      `;
      const res = await pool.query(sql, [newStatus, errMsg, nextRunAt, now, taskId]);
      if (res && res.rows && res.rows[0]) {
        return normalizeTaskRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database markTaskFailed error, using fallback:', err.message);
    }
  }

  const task = memoryQueue.find(t => t.id === taskId);
  if (task) {
    task.status = newStatus;
    task.last_error = errMsg;
    task.next_run_at = nextRunAt.toISOString();
    task.updated_at = now.toISOString();
    return normalizeTaskRecord(task);
  }
  return null;
}

/**
 * Fetches task record by ID.
 * 
 * @param {string} taskId 
 * @returns {Promise<object|null>}
 */
async function getTaskById(taskId) {
  const pool = db.getPool();
  if (pool) {
    try {
      const sql = 'SELECT * FROM dispatch_queue WHERE id = $1;';
      const res = await pool.query(sql, [taskId]);
      if (res && res.rows && res.rows[0]) {
        return normalizeTaskRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database getTaskById error, using fallback:', err.message);
    }
  }

  const task = memoryQueue.find(t => t.id === taskId);
  return task ? normalizeTaskRecord(task) : null;
}

/**
 * Fetches all tasks for a given article ID.
 * 
 * @param {string} articleId 
 * @returns {Promise<Array<object>>}
 */
async function getTasksByArticleId(articleId) {
  const pool = db.getPool();
  if (pool) {
    try {
      const sql = 'SELECT * FROM dispatch_queue WHERE article_id = $1 ORDER BY created_at DESC;';
      const res = await pool.query(sql, [String(articleId)]);
      if (res && res.rows) {
        return res.rows.map(normalizeTaskRecord);
      }
    } catch (err) {
      console.error('Database getTasksByArticleId error, using fallback:', err.message);
    }
  }

  const tasks = memoryQueue.filter(t => t.article_id === String(articleId));
  return tasks.map(normalizeTaskRecord);
}

/**
 * Fetches all tasks in queue.
 * 
 * @returns {Promise<Array<object>>}
 */
async function getAllTasks() {
  const pool = db.getPool();
  if (pool) {
    try {
      const sql = 'SELECT * FROM dispatch_queue ORDER BY created_at DESC;';
      const res = await pool.query(sql);
      if (res && res.rows) {
        return res.rows.map(normalizeTaskRecord);
      }
    } catch (err) {
      console.error('Database getAllTasks error, using fallback:', err.message);
    }
  }

  return memoryQueue.map(normalizeTaskRecord);
}

/**
 * Clears queue store (for test resets).
 */
async function clearQueue() {
  memoryQueue = [];
  const pool = db.getPool();
  if (pool) {
    try {
      await pool.query('TRUNCATE TABLE dispatch_queue;');
    } catch (err) {
      // Ignore truncate error in test fallback
    }
  }
}

/**
 * Releases tasks locked in 'processing' status longer than staleThresholdMs.
 * Resets task status from 'processing' to 'pending'.
 * 
 * @param {number} [staleThresholdMs=600000] Stale lock expiration threshold in milliseconds (default: 10 minutes).
 * @returns {Promise<Array<object>>} Recovered task records.
 */
async function recoverStaleLocks(staleThresholdMs = 10 * 60 * 1000) {
  const pool = db.getPool();
  const now = new Date();
  const cutoff = new Date(now.getTime() - staleThresholdMs);

  if (pool) {
    try {
      const failSql = `
        UPDATE dispatch_queue
        SET status = 'failed',
            last_error = 'Stale lock expired after reaching maximum attempts',
            updated_at = $1
        WHERE status = 'processing'
          AND COALESCE(updated_at, created_at) <= $2
          AND attempts >= max_attempts
        RETURNING *;
      `;
      const failRes = await pool.query(failSql, [now, cutoff]);

      const sql = `
        UPDATE dispatch_queue
        SET status = 'pending',
            updated_at = $1
        WHERE status = 'processing'
          AND COALESCE(updated_at, created_at) <= $2
          AND attempts < max_attempts
        RETURNING *;
      `;
      const res = await pool.query(sql, [now, cutoff]);
      const recoveredRows = [
        ...(failRes && failRes.rows ? failRes.rows : []),
        ...(res && res.rows ? res.rows : [])
      ];
      return recoveredRows.map(normalizeTaskRecord);
    } catch (err) {
      console.error('Database recoverStaleLocks error, using fallback:', err.message);
    }
  }

  // Fallback in-memory stale lock recovery
  const cutoffTs = cutoff.getTime();
  const recovered = [];

  for (const task of memoryQueue) {
    if (task.status === 'processing') {
      const updatedAtTs = new Date(task.updated_at || task.created_at).getTime();
      if (updatedAtTs <= cutoffTs) {
        if (task.attempts >= task.max_attempts) {
          task.status = 'failed';
          task.last_error = 'Stale lock expired after reaching maximum attempts';
        } else {
          task.status = 'pending';
        }
        task.updated_at = now.toISOString();
        recovered.push(normalizeTaskRecord(task));
      }
    }
  }

  return recovered;
}

module.exports = {
  enqueueTask,
  claimPendingTasks,
  markTaskComplete,
  markTaskFailed,
  getTaskById,
  getTasksByArticleId,
  getAllTasks,
  clearQueue,
  recoverStaleLocks
};
