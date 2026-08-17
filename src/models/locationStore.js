const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'locations.test.json' : 'locations.json');

const DEFAULT_SEED_LOCATIONS = [
  {
    id: 'lb',
    name: 'Lebanon',
    country: 'Lebanon',
    countryCode: 'LB',
    regionId: 'levant',
    regionName: 'Levant',
    timezone: 'Asia/Beirut',
    enabled: true
  },
  {
    id: 'sa-riyadh',
    name: 'Riyadh',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    regionId: 'gcc',
    regionName: 'GCC',
    timezone: 'Asia/Riyadh',
    enabled: true
  },
  {
    id: 'ae-dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    regionId: 'gcc',
    regionName: 'GCC',
    timezone: 'Asia/Dubai',
    enabled: true
  },
  {
    id: 'eg-cairo',
    name: 'Cairo',
    country: 'Egypt',
    countryCode: 'EG',
    regionId: 'north-africa',
    regionName: 'North Africa',
    timezone: 'Africa/Cairo',
    enabled: true
  }
];

let writeQueue = Promise.resolve();
let queue = Promise.resolve();

function enqueue(fn) {
  const res = queue.then(() => fn());
  queue = res.catch(() => {});
  return res;
}

async function ensureInitialized() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists or creation failed
  }

  try {
    await fs.access(FILE_PATH);
  } catch (err) {
    await fs.writeFile(FILE_PATH, JSON.stringify(DEFAULT_SEED_LOCATIONS, null, 2), 'utf8');
  }
}

async function getAllLocations() {
  await ensureInitialized();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveAll(locations) {
  await ensureInitialized();
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    await fs.writeFile(tempPath, JSON.stringify(locations, null, 2), 'utf8');
    await fs.rename(tempPath, FILE_PATH);
  }).catch(err => {
    console.error('Failed to save location store:', err);
  });
  return writeQueue;
}

async function getLocationById(id) {
  if (!id) return null;
  const locations = await getAllLocations();
  return locations.find(l => l.id && l.id.toLowerCase() === String(id).toLowerCase()) || null;
}

async function createLocation(locationData) {
  return enqueue(async () => {
    const locations = await getAllLocations();
    const id = String(locationData.id || '').trim().toLowerCase();

    if (!id) {
      throw new Error('Location ID is required.');
    }

    const existingIndex = locations.findIndex(l => l.id && l.id.toLowerCase() === id);
    if (existingIndex !== -1) {
      throw new Error(`Location with ID '${id}' already exists.`);
    }

    const newLocation = {
      id,
      name: locationData.name || id,
      country: locationData.country || '',
      countryCode: locationData.countryCode || '',
      regionId: (locationData.regionId || 'other').toLowerCase(),
      regionName: locationData.regionName || 'Other',
      timezone: locationData.timezone || 'UTC',
      enabled: locationData.enabled !== undefined ? Boolean(locationData.enabled) : true
    };

    locations.push(newLocation);
    await saveAll(locations);
    return newLocation;
  });
}

async function updateLocation(id, updateData) {
  return enqueue(async () => {
    const locations = await getAllLocations();
    const normalizedId = String(id).trim().toLowerCase();
    const index = locations.findIndex(l => l.id && l.id.toLowerCase() === normalizedId);

    if (index === -1) {
      return null;
    }

    const existing = locations[index];
    const updated = {
      ...existing,
      name: typeof updateData.name === 'string' ? updateData.name : existing.name,
      country: typeof updateData.country === 'string' ? updateData.country : existing.country,
      countryCode: typeof updateData.countryCode === 'string' ? updateData.countryCode : existing.countryCode,
      regionId: typeof updateData.regionId === 'string' ? updateData.regionId.toLowerCase() : existing.regionId,
      regionName: typeof updateData.regionName === 'string' ? updateData.regionName : existing.regionName,
      timezone: typeof updateData.timezone === 'string' ? updateData.timezone : existing.timezone,
      enabled: updateData.enabled !== undefined ? Boolean(updateData.enabled) : existing.enabled
    };

    locations[index] = updated;
    await saveAll(locations);
    return updated;
  });
}

async function deleteLocation(id) {
  return enqueue(async () => {
    const locations = await getAllLocations();
    const normalizedId = String(id).trim().toLowerCase();
    const index = locations.findIndex(l => l.id && l.id.toLowerCase() === normalizedId);

    if (index === -1) {
      return false;
    }

    locations.splice(index, 1);
    await saveAll(locations);
    return true;
  });
}

/**
 * Regional Models and Grouping Logic
 */

/**
 * Returns locations grouped by region.
 * @returns {Promise<Array<{ id: string, name: string, locations: Array<Object> }>>}
 */
async function getRegionalGroups() {
  const locations = await getAllLocations();
  const activeLocations = locations.filter(l => l.enabled !== false);

  const regionMap = new Map();

  activeLocations.forEach(loc => {
    const rId = (loc.regionId || 'other').toLowerCase();
    if (!regionMap.has(rId)) {
      regionMap.set(rId, {
        id: rId,
        name: loc.regionName || rId.toUpperCase(),
        locations: []
      });
    }
    regionMap.get(rId).locations.push(loc);
  });

  return Array.from(regionMap.values());
}

/**
 * Returns all active locations in a given region.
 * @param {string} regionId
 */
async function getLocationsByRegion(regionId) {
  if (!regionId) return [];
  const locations = await getAllLocations();
  const normalizedRegion = String(regionId).trim().toLowerCase();
  return locations.filter(l => (l.regionId || '').toLowerCase() === normalizedRegion && l.enabled !== false);
}

/**
 * Filters an array of articles/posts by regional group.
 * @param {Array} articles List of articles
 * @param {string} regionId Target region ID
 */
async function getArticlesByRegion(articles, regionId) {
  if (!regionId || !Array.isArray(articles)) return articles;
  const regionLocations = await getLocationsByRegion(regionId);
  const locationIds = new Set(regionLocations.map(l => (l.id || '').toLowerCase()));

  return articles.filter(a => a.locationId && locationIds.has(a.locationId.toLowerCase()));
}

async function clearStore(useSeed = false) {
  return enqueue(async () => {
    if (useSeed) {
      await saveAll(DEFAULT_SEED_LOCATIONS);
    } else {
      await saveAll([]);
    }
  });
}

module.exports = {
  ensureInitialized,
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getRegionalGroups,
  getLocationsByRegion,
  getArticlesByRegion,
  clearStore
};
