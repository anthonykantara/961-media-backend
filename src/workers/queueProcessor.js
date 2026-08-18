const queueStore = require('../models/queueStore');
const { dispatchAll } = require('./dispatchWorker');

let workerTimer = null;
const activeTaskIds = new Set();

/**
 * Claims and processes all currently ready tasks in background queue.
 * Executes tasks concurrently and updates their status in queueStore.
 * 
 * @returns {Promise<Array<object>>} List of processed task results.
 */
async function processNextTasks() {
  const tasks = await queueStore.claimPendingTasks(10);
  if (tasks.length === 0) return [];

  const processedResults = [];

  await Promise.all(tasks.map(async (task) => {
    activeTaskIds.add(task.id);
    try {
      const result = await dispatchAll(task.article_id, task.options || {});

      // Check if any distribution worker in dispatchAll rejected or reported success = false
      const failures = Object.entries(result.dispatches || {}).filter(([_, v]) => {
        if (!v) return false;
        if (v.status === 'rejected') return true;
        if (v.status === 'fulfilled' && v.value && v.value.success === false) return true;
        return false;
      });

      if (failures.length > 0) {
        const errMsg = failures.map(([name, res]) => {
          if (res.status === 'rejected') {
            return `${name} worker failed: ${res.reason || 'Unknown error'}`;
          }
          const val = res.value || {};
          const details = [];
          if (Array.isArray(val.uploadErrors) && val.uploadErrors.length > 0) {
            details.push(val.uploadErrors.map(e => `${e.file}: ${e.error}`).join(', '));
          }
          if (Array.isArray(val.scanErrors) && val.scanErrors.length > 0) {
            details.push(val.scanErrors.map(e => `${e.prefix}: ${e.error}`).join(', '));
          }
          if (Array.isArray(val.deleteErrors) && val.deleteErrors.length > 0) {
            details.push(val.deleteErrors.map(e => `${e.key}: ${e.error}`).join(', '));
          }
          if (details.length === 0 && val.error) {
            details.push(val.error);
          }
          return `${name} worker failed: ${details.join('; ') || 'Execution unsuccessful'}`;
        }).join('; ');

        const updatedTask = await queueStore.markTaskFailed(
          task.id,
          new Error(errMsg),
          task.attempts,
          task.max_attempts,
          task.options
        );
        processedResults.push({ taskId: task.id, status: updatedTask ? updatedTask.status : 'failed', error: errMsg, result });
      } else {
        const updatedTask = await queueStore.markTaskComplete(task.id, result);
        processedResults.push({ taskId: task.id, status: 'completed', result });
      }
    } catch (err) {
      const updatedTask = await queueStore.markTaskFailed(
        task.id,
        err,
        task.attempts,
        task.max_attempts,
        task.options
      );
      processedResults.push({ taskId: task.id, status: updatedTask ? updatedTask.status : 'failed', error: err.message });
    } finally {
      activeTaskIds.delete(task.id);
    }
  }));

  return processedResults;
}

/**
 * Immediately triggers background queue processing.
 */
function triggerImmediateProcessing() {
  setImmediate(() => {
    processNextTasks().catch(err => {
      console.error('Error in immediate queue processing:', err.message);
    });
  });
}

/**
 * Starts periodic background queue processing worker loop.
 * 
 * @param {number} [intervalMs=1000] Interval in milliseconds between polling checks.
 */
function startQueueWorker(intervalMs = 1000) {
  if (!workerTimer) {
    workerTimer = setInterval(() => {
      processNextTasks().catch(err => {
        console.error('Error in periodic queue processing:', err.message);
      });
    }, intervalMs);

    if (workerTimer.unref) {
      workerTimer.unref();
    }
  }
}

/**
 * Stops periodic background queue processing worker loop.
 */
function stopQueueWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

module.exports = {
  processNextTasks,
  triggerImmediateProcessing,
  startQueueWorker,
  stopQueueWorker
};
