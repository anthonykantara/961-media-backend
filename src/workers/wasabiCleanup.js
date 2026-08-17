const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSocialSecrets } = require('../services/secrets');

/**
 * Wasabi Storage Cleanup Worker:
 * Automatically purges unapproved temporary social media images and draft assets
 * from Wasabi Cloud Storage upon publication.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional overrides and mocks.
 * @returns {Promise<object>} Result containing deleted keys.
 */
async function wasabiCleanup(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const wasabi = secrets.wasabi;

  const articleId = article.id || article._id;

  const keysToDelete = new Set(options.keysToDelete || []);

  // Collect explicitly referenced temporary/draft assets
  const assetArrays = [
    article.draftAssets,
    article.tempImages,
    article.temporarySocialImages,
    article.unapprovedAssets
  ];

  assetArrays.forEach(arr => {
    if (Array.isArray(arr)) {
      arr.forEach(k => {
        if (typeof k === 'string') {
          // Extract key if full URL or key string
          const cleanKey = k.replace(/^https?:\/\/[^\/]+\//, '');
          keysToDelete.add(cleanKey);
        }
      });
    }
  });

  const s3Client = options.s3Client || new S3Client({
    region: wasabi.region || 'us-east-1',
    endpoint: wasabi.endpoint || 'https://s3.wasabisys.com',
    credentials: {
      accessKeyId: wasabi.accessKeyId || 'mock-key',
      secretAccessKey: wasabi.secretAccessKey || 'mock-secret'
    }
  });

  const bucket = options.bucket || wasabi.bucket || '961-media-drafts';

  // Discover assets by prefix if articleId is present
  if (articleId && !options.skipPrefixScan) {
    const prefixes = [`drafts/${articleId}/`, `temp/${articleId}/`];
    for (const prefix of prefixes) {
      try {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix
        });
        const listRes = await s3Client.send(listCmd);
        if (listRes && listRes.Contents) {
          listRes.Contents.forEach(item => {
            if (item.Key) {
              keysToDelete.add(item.Key);
            }
          });
        }
      } catch (err) {
        // Log prefix list error if any
      }
    }
  }

  const keysList = Array.from(keysToDelete);
  const deletedKeys = [];

  if (keysList.length > 0) {
    if (options.mockDelete) {
      deletedKeys.push(...keysList);
    } else {
      try {
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keysList.map(Key => ({ Key }))
          }
        });
        const deleteRes = await s3Client.send(deleteCmd);
        if (deleteRes && deleteRes.Deleted) {
          deleteRes.Deleted.forEach(d => deletedKeys.push(d.Key));
        } else {
          deletedKeys.push(...keysList);
        }
      } catch (err) {
        // Fallback to deleting individually if bulk delete fails
        for (const key of keysList) {
          try {
            await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            deletedKeys.push(key);
          } catch (e) {
            console.error(`Failed to delete Wasabi key ${key}:`, e.message);
          }
        }
      }
    }
  }

  return {
    success: true,
    bucket,
    deletedKeys
  };
}

module.exports = {
  wasabiCleanup
};
