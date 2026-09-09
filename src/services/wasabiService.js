const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const secretsManager = require('./secretsManager');

function getMediaPublicUrl(key) {
  const base = (process.env.MEDIA_CDN_URL || 'https://media.the961.com').replace(/\/+$/, '');
  return `${base}/${key.replace(/^\/+/, '')}`;
}

async function uploadToWasabi(buffer, key, contentType = 'image/png', options = {}) {
  const { throwOnError = false, profile = 'default', publicRead = true } = options;
  const credentials = profile === 'media'
    ? await secretsManager.getMediaWasabiCredentials()
    : await secretsManager.getWasabiCredentials();
  const isMock = !credentials.accessKeyId || credentials.accessKeyId === 'mock-wasabi-access-key' || process.env.NODE_ENV === 'test';

  const s3Client = new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
    forcePathStyle: true
  });

  const uploadParams = { Bucket: credentials.bucket, Key: key, Body: buffer, ContentType: contentType };
  if (publicRead) uploadParams.ACL = 'public-read';

  if (!isMock) {
    try {
      await s3Client.send(new PutObjectCommand(uploadParams));
    } catch (err) {
      if (throwOnError) throw err;
      console.warn('Wasabi upload warning (using URL fallback):', err.message);
    }
  }

  return getMediaPublicUrl(key);
}

module.exports = { uploadToWasabi, getMediaPublicUrl };
