const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const secretsManager = require('../services/secretsManager');

let cleanupTimer = null;

async function getS3Client() {
  const credentials = await secretsManager.getWasabiCredentials();
  const isMock = !credentials.accessKeyId || credentials.accessKeyId === 'mock-wasabi-access-key' || process.env.NODE_ENV === 'test';

  const s3Client = new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey
    },
    forcePathStyle: true
  });

  return { s3Client, bucket: credentials.bucket, isMock };
}

/**
 * Clean temporary campaign assets older than maxAgeHours (default 24h)
 */
async function cleanTemporaryAdAssets(maxAgeHours = 24, options = {}) {
  const { s3Client, bucket, isMock } = await getS3Client();
  const deletedKeys = [];
  const errors = [];

  if (isMock || options.mock) {
    return { success: true, deletedKeys: options.mockKeys || [], errors: [] };
  }

  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'campaigns/temporary/'
    });
    const listRes = await s3Client.send(listCmd);
    const contents = listRes.Contents || [];

    const now = Date.now();
    const cutoffTime = now - (maxAgeHours * 60 * 60 * 1000);

    for (const item of contents) {
      if (item.LastModified && new Date(item.LastModified).getTime() < cutoffTime) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: item.Key
          }));
          deletedKeys.push(item.Key);
        } catch (err) {
          errors.push({ key: item.Key, error: err.message });
        }
      }
    }
  } catch (err) {
    errors.push({ error: err.message });
  }

  return { success: errors.length === 0, deletedKeys, errors };
}

/**
 * Migrate temporary campaign assets under campaigns/temporary/{sessionId}/ to campaigns/permanent/{campaignId}/
 */
async function migrateAdAssetsToPermanent(sessionId, campaignId, options = {}) {
  const { s3Client, bucket, isMock } = await getS3Client();
  const migratedKeys = [];
  const errors = [];

  if (isMock || options.mock) {
    const mockKey = `campaigns/permanent/${campaignId}/file.png`;
    return { success: true, migratedKeys: [mockKey], errors: [] };
  }

  try {
    const tempPrefix = `campaigns/temporary/${sessionId}/`;
    const listCmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: tempPrefix
    });

    const listRes = await s3Client.send(listCmd);
    const contents = listRes.Contents || [];

    for (const item of contents) {
      const fileName = item.Key.substring(tempPrefix.length);
      const permKey = `campaigns/permanent/${campaignId}/${fileName}`;

      try {
        // Copy to permanent location
        await s3Client.send(new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${item.Key}`,
          Key: permKey,
          ACL: 'public-read'
        }));

        // Delete temporary copy
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: item.Key
        }));

        migratedKeys.push(permKey);
      } catch (err) {
        errors.push({ sourceKey: item.Key, error: err.message });
      }
    }
  } catch (err) {
    errors.push({ error: err.message });
  }

  return { success: errors.length === 0, migratedKeys, errors };
}

/**
 * Starts active background scheduler for purging expired temporary assets
 */
function startWasabiAdCleanupScheduler(intervalMs = 3600000, maxAgeHours = 24) {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  cleanupTimer = setInterval(async () => {
    try {
      await cleanTemporaryAdAssets(maxAgeHours);
    } catch (err) {
      console.error('Wasabi temporary asset cleanup background task error:', err.message);
    }
  }, intervalMs);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
  return cleanupTimer;
}

/**
 * Stops background cleanup scheduler
 */
function stopWasabiAdCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = {
  cleanTemporaryAdAssets,
  migrateAdAssetsToPermanent,
  startWasabiAdCleanupScheduler,
  stopWasabiAdCleanupScheduler
};
