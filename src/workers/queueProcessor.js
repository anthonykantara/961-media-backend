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

      // Check if any distribution worker in dispatchAll rejected
      const failures = Object.entries(result.dispatches || {}).filter(([_, v]) => v && v.status === 'rejected');

      if (failures.length > 0) {
        const errMsg = failures.map(([name, res]) => `${name} worker failed: ${res.reason || 'Unknown error'}`).join('; ');
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
