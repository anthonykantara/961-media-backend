const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const secretsManager = require('./secretsManager');

function getMediaPublicUrl(key) {
  const base = (process.env.MEDIA_CDN_URL || 'https://media.the961.com').replace(/\/+$/, '');
  return `${base}/${key.replace(/^\/+/, '')}`;
}

/**
 * Upload a file to Wasabi and return the canonical public media URL.
 * The storage provider remains hidden behind MEDIA_CDN_URL.
 */
async function uploadToWasabi(buffer, key, contentType = 'image/png') {
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

  const uploadParams = {
    Bucket: credentials.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  if (!isMock) {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
  }

  return getMediaPublicUrl(key);
}

module.exports = {
  uploadToWasabi,
  getMediaPublicUrl
};
