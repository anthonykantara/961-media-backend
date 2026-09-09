const sharp = require('sharp');

// Keep Sharp's internal caches bounded on the small production instance.
const memoryMb = Number.parseInt(process.env.SHARP_CACHE_MEMORY_MB || '64', 10);
const itemCount = Number.parseInt(process.env.SHARP_CACHE_ITEMS || '20', 10);
const concurrency = Number.parseInt(process.env.SHARP_CONCURRENCY || '2', 10);

sharp.cache({
  memory: Number.isFinite(memoryMb) && memoryMb >= 0 ? memoryMb : 64,
  items: Number.isFinite(itemCount) && itemCount >= 0 ? itemCount : 20,
  files: 0
});

if (Number.isFinite(concurrency) && concurrency > 0) {
  sharp.concurrency(concurrency);
}

module.exports = {};
