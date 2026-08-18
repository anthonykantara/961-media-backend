const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSocialSecrets } = require('../services/secrets');

/**
 * Wasabi Storage Cleanup Worker:
 * Automatically purges unapproved temporary social media images and draft assets
 * from Wasabi Cloud Storage upon publication.
 * Scans prefixes concurrently and reports failures explicitly.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional overrides and mocks.
 * @returns {Promise<object>} Result containing deleted keys.
 */
async function wasabiCleanup(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const wasabi = secrets.wasabi || {};

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
  const scanErrors = [];

  // Discover assets by prefix concurrently if articleId is present
  if (articleId && !options.skipPrefixScan) {
    const prefixes = [`drafts/${articleId}/`, `temp/${articleId}/`];
    const scanPromises = prefixes.map(async (prefix) => {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix
      });
      const listRes = await s3Client.send(listCmd);
      return { prefix, items: listRes && listRes.Contents ? listRes.Contents : [] };
    });

    const scanResults = await Promise.allSettled(scanPromises);
    scanResults.forEach((res, index) => {
      if (res.status === 'fulfilled' && res.value) {
        res.value.items.forEach(item => {
          if (item.Key) keysToDelete.add(item.Key);
        });
      } else if (res.status === 'rejected') {
        const errDetail = res.reason && res.reason.message ? res.reason.message : String(res.reason);
        console.error(`Wasabi prefix scan failure for [${prefixes[index]}]:`, errDetail);
        scanErrors.push({ prefix: prefixes[index], error: errDetail });
      }
    });
  }

  const keysList = Array.from(keysToDelete);
  const deletedKeys = [];
  const deleteErrors = [];

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
        console.error('Bulk Wasabi deletion failed, attempting individual delete fallback:', err.message);
        // Fallback to deleting individually concurrently if bulk delete fails
        const singleDeletePromises = keysList.map(async (key) => {
          await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          return key;
        });

        const singleResults = await Promise.allSettled(singleDeletePromises);
        singleResults.forEach((res, index) => {
          if (res.status === 'fulfilled') {
            deletedKeys.push(res.value);
          } else {
            const errDetail = res.reason && res.reason.message ? res.reason.message : String(res.reason);
            console.error(`Failed to delete Wasabi key ${keysList[index]}:`, errDetail);
            deleteErrors.push({ key: keysList[index], error: errDetail });
          }
        });
      }
    }
  }

  return {
    success: scanErrors.length === 0 && deleteErrors.length === 0,
    bucket,
    deletedKeys,
    scanErrors,
    deleteErrors
  };
}

module.exports = {
  wasabiCleanup
};
