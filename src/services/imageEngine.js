const { spawn } = require('child_process');
const path = require('path');

const PYTHON_ENGINE_PATH = path.join(__dirname, '../engine/pillow_engine.py');

/**
 * Invokes Python Pillow engine to process Express Creation workflow images.
 * @param {Object} payload Payload containing headline, carousel_slides, image/imageUrl, etc.
 * @returns {Promise<Object>} Execution result containing CDN URLs and image details.
 */
function processExpressCreation(payload) {
  return new Promise((resolve, reject) => {
    const pythonProc = spawn('python3', [PYTHON_ENGINE_PATH], {
      env: { ...process.env }
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProc.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProc.on('error', (err) => {
      reject(new Error(`Failed to start Python Pillow engine: ${err.message}`));
    });

    pythonProc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python engine exited with code ${code}: ${stderrData || stdoutData}`));
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python engine output: ${err.message}. Output: ${stdoutData}`));
      }
    });

    // Write input payload JSON to stdin
    pythonProc.stdin.write(JSON.stringify(payload || {}));
    pythonProc.stdin.end();
  });
}

module.exports = {
  processExpressCreation
};
