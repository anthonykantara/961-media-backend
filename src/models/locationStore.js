const db = require('../db');

let memoryLocations = [];

function formatLocationRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    country: row.country || '',
    countryCode: row.country_code || row.countryCode || '',
    regionId: row.region_id || row.regionId || 'other',
    regionName: row.region_name || row.regionName || 'Other',
    timezone: row.timezone || 'UTC',
    enabled: row.enabled !== undefined ? Boolean(row.enabled) : true
  };
}

async function ensureInitialized() {
  // The CMS must remain empty when the database is empty.
  // Do not seed demo or default locations here.
  return;
}

async function getAllLocations() {
  await ensureInitialized();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM locations ORDER BY id ASC;');
      if (res && res.rows) {
        return res.rows.map(formatLocationRecord);
      }
    } catch (err) {
      console.error('Database getAllLocations error, using fallback:', err.message);
    }
  }

  return memoryLocations.map(formatLocationRecord);
}

async function getLocationById(id) {
  if (!id) return null;
  const normalizedId = String(id).trim().toLowerCase();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM locations WHERE LOWER(id) = $1 LIMIT 1;', [normalizedId]);
      if (res && res.rows && res.rows[0]) {
        return formatLocationRecord(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.error('Database getLocationById error, using fallback:', err.message);
    }
  }

  const found = memoryLocations.find(l => l.id && l.id.toLowerCase() === normalizedId);
  return found ? formatLocationRecord(found) : null;
}

async function createLocation(locationData) {
  const id = String(locationData.id || '').trim().toLowerCase();
  if (!id) throw new Error('Location ID is required.');

  const existing = await getLocationById(id);
  if (existing) throw new Error(`Location with ID '${id}' already exists.`);

  const newLocation = {
    id,
    name: locationData.name || id,
    country: locationData.country || '',
    countryCode: locationData.countryCode || locationData.country_code || '',
    regionId: (locationData.regionId || locationData.region_id || 'other').toLowerCase(),
    regionName: locationData.regionName || locationData.region_name || 'Other',
    timezone: locationData.timezone || 'UTC',
    enabled: locationData.enabled !== undefined ? Boolean(locationData.enabled) : true
  };

  const pool = db.getPool();
  if (pool) {
    try {
      const sql = `
        INSERT INTO locations (id, name, country, country_code, region_id, region_name, timezone, enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        newLocation.id,
        newLocation.name,
        newLocation.country,
        newLocation.countryCode,
        newLocation.regionId,
        newLocation.regionName,
        newLocation.timezone,
        newLocation.enabled
      ]);
      if (res && res.rows && res.rows[0]) return formatLocationRecord(res.rows[0]);
    } catch (err) {
      console.error('Database createLocation error, using fallback:', err.message);
    }
  }

  memoryLocations.push(newLocation);
  return formatLocationRecord(newLocation);
}

async function updateLocation(id, updateData) {
  const normalizedId = String(id).trim().toLowerCase();
  const existing = await getLocationById(normalizedId);
  if (!existing) return null;

  const updatedName = typeof updateData.name === 'string' ? updateData.name : existing.name;
  const updatedCountry = typeof updateData.country === 'string' ? updateData.country : existing.country;
  const updatedCountryCode = typeof updateData.countryCode === 'string' ? updateData.countryCode : existing.countryCode;
  const updatedRegionId = typeof updateData.regionId === 'string' ? updateData.regionId.toLowerCase() : existing.regionId;
  const updatedRegionName = typeof updateData.regionName === 'string' ? updateData.regionName : existing.regionName;
  const updatedTimezone = typeof updateData.timezone === 'string' ? updateData.timezone : existing.timezone;
  const updatedEnabled = updateData.enabled !== undefined ? Boolean(updateData.enabled) : existing.enabled;

  const pool = db.getPool();
  if (pool) {
    try {
      const sql = `
        UPDATE locations
        SET name = $1, country = $2, country_code = $3, region_id = $4,
            region_name = $5, timezone = $6, enabled = $7, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(id) = $8
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        updatedName,
        updatedCountry,
        updatedCountryCode,
        updatedRegionId,
        updatedRegionName,
        updatedTimezone,
        updatedEnabled,
        normalizedId
      ]);
      if (res && res.rows && res.rows[0]) return formatLocationRecord(res.rows[0]);
    } catch (err) {
      console.error('Database updateLocation error, using fallback:', err.message);
    }
  }

  const index = memoryLocations.findIndex(l => l.id && l.id.toLowerCase() === normalizedId);
  if (index === -1) return null;

  memoryLocations[index] = {
    ...memoryLocations[index],
    name: updatedName,
    country: updatedCountry,
    countryCode: updatedCountryCode,
    regionId: updatedRegionId,
    regionName: updatedRegionName,
    timezone: updatedTimezone,
    enabled: updatedEnabled
  };
  return formatLocationRecord(memoryLocations[index]);
}

async function deleteLocation(id) {
  const normalizedId = String(id).trim().toLowerCase();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('DELETE FROM locations WHERE LOWER(id) = $1 RETURNING id;', [normalizedId]);
      return Boolean(res && res.rows && res.rows.length > 0);
    } catch (err) {
      console.error('Database deleteLocation error, using fallback:', err.message);
    }
  }

  const index = memoryLocations.findIndex(l => l.id && l.id.toLowerCase() === normalizedId);
  if (index === -1) return false;
  memoryLocations.splice(index, 1);
  return true;
}

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

async function getLocationsByRegion(regionId) {
  if (!regionId) return [];
  const locations = await getAllLocations();
  const normalizedRegion = String(regionId).trim().toLowerCase();
  return locations.filter(l => (l.regionId || '').toLowerCase() === normalizedRegion && l.enabled !== false);
}

async function getArticlesByRegion(articles, regionId) {
  if (!regionId || !Array.isArray(articles)) return articles;
  const regionLocations = await getLocationsByRegion(regionId);
  const locationIds = new Set(regionLocations.map(l => (l.id || '').toLowerCase()));
  return articles.filter(a => a.locationId && locationIds.has(a.locationId.toLowerCase()));
}

async function clearStore(useSeed = false) {
  const pool = db.getPool();
  if (pool) {
    try {
      await pool.query('TRUNCATE TABLE locations;');
      if (useSeed) {
        console.warn('clearStore(useSeed=true) ignored: seeded locations are disabled.');
      }
    } catch (err) {
      console.error('Database clearStore error, using fallback:', err.message);
    }
  }
  memoryLocations = [];
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
