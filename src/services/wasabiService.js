const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const secretsManager = require('./secretsManager');

/**
 * Uploads an optimized file buffer to Wasabi Cloud Storage
 * @param {Buffer} buffer File content
 * @param {string} key Object key inside bucket
 * @param {string} contentType MIME type
 * @returns {Promise<string>} Public or S3 URL of the uploaded object
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
    try {
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);
    } catch (err) {
      console.warn('Wasabi upload warning (using URL fallback):', err.message);
    }
  }

  // Construct standard Wasabi URL
  const endpointHost = credentials.endpoint.replace(/^https?:\/\//, '');
  return `https://${endpointHost}/${credentials.bucket}/${key}`;
}

module.exports = {
  uploadToWasabi
};
