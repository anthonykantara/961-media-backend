const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretCache = new Map();
const APP_SECRET_NAME = process.env.MEDIA_BACKEND_SECRET_NAME || '961-MEDIA-BACKEND';

async function getSecret(secretName) {
  if (!secretName) return null;
  if (secretCache.has(secretName)) return secretCache.get(secretName);

  if (process.env[secretName]) {
    const envVal = process.env[secretName];
    try {
      const parsed = JSON.parse(envVal);
      secretCache.set(secretName, parsed);
      return parsed;
    } catch {
      secretCache.set(secretName, envVal);
      return envVal;
    }
  }

  try {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const client = new SecretsManagerClient({ region });
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!response.SecretString) return null;

    let secretValue;
    try { secretValue = JSON.parse(response.SecretString); }
    catch { secretValue = response.SecretString; }
    secretCache.set(secretName, secretValue);
    return secretValue;
  } catch (err) {
    if (process.env[secretName]) return process.env[secretName];
    console.warn(`Unable to load secret '${secretName}':`, err.message);
    return null;
  }
}

async function getAppSecret() { return getSecret(APP_SECRET_NAME); }

async function getAppSecretField(fieldName, fallback = null) {
  const secret = await getAppSecret();
  if (secret && typeof secret === 'object' && secret[fieldName] !== undefined && secret[fieldName] !== null) return secret[fieldName];
  return fallback;
}

async function getGeminiApiKey() {
  const bundled = await getAppSecretField('GEMINI_API_KEY');
  if (bundled) return bundled;
  const secret = await getSecret(process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY');
  if (typeof secret === 'object' && secret !== null) return secret.GEMINI_API_KEY || secret.apiKey || secret.api_key || process.env.GEMINI_API_KEY || 'mock-gemini-key';
  return secret || process.env.GEMINI_API_KEY || 'mock-gemini-key';
}

async function getWasabiCredentials() {
  const secret = await getSecret(process.env.WASABI_SECRET_NAME || 'WASABI_CREDENTIALS');
  if (typeof secret === 'object' && secret !== null) {
    return {
      accessKeyId: secret.WASABI_ACCESS_KEY_ID || secret.accessKeyId || process.env.WASABI_ACCESS_KEY_ID,
      secretAccessKey: secret.WASABI_SECRET_ACCESS_KEY || secret.secretAccessKey || process.env.WASABI_SECRET_ACCESS_KEY,
      bucket: secret.WASABI_BUCKET || secret.bucket || process.env.WASABI_BUCKET || 'content-pipeline-assets',
      region: secret.WASABI_REGION || secret.region || process.env.WASABI_REGION || 'us-east-1',
      endpoint: secret.WASABI_ENDPOINT || secret.endpoint || process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'
    };
  }
  return {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID || 'mock-wasabi-access-key',
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY || 'mock-wasabi-secret-key',
    bucket: process.env.WASABI_BUCKET || 'content-pipeline-assets',
    region: process.env.WASABI_REGION || 'us-east-1',
    endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'
  };
}

async function getMediaWasabiCredentials() {
  const bundled = await getAppSecret();
  if (bundled && typeof bundled === 'object' && (bundled.WASABI_ACCESS_KEY_ID || bundled.WASABI_SECRET_ACCESS_KEY)) {
    return {
      accessKeyId: bundled.WASABI_ACCESS_KEY_ID || bundled.accessKeyId || process.env.WASABI_MEDIA_ACCESS_KEY_ID,
      secretAccessKey: bundled.WASABI_SECRET_ACCESS_KEY || bundled.secretAccessKey || process.env.WASABI_MEDIA_SECRET_ACCESS_KEY,
      bucket: bundled.WASABI_BUCKET || bundled.bucket || process.env.WASABI_MEDIA_BUCKET || 'the961-media',
      region: bundled.WASABI_REGION || bundled.region || process.env.WASABI_MEDIA_REGION || 'eu-south-1',
      endpoint: bundled.WASABI_ENDPOINT || bundled.endpoint || process.env.WASABI_MEDIA_ENDPOINT || 'https://s3.eu-south-1.wasabisys.com'
    };
  }
  const secret = await getSecret(process.env.WASABI_MEDIA_SECRET_NAME || 'WASABI_MEDIA_CREDENTIALS');
  if (typeof secret === 'object' && secret !== null) {
    return {
      accessKeyId: secret.WASABI_ACCESS_KEY_ID || secret.accessKeyId || process.env.WASABI_MEDIA_ACCESS_KEY_ID,
      secretAccessKey: secret.WASABI_SECRET_ACCESS_KEY || secret.secretAccessKey || process.env.WASABI_MEDIA_SECRET_ACCESS_KEY,
      bucket: secret.WASABI_BUCKET || secret.bucket || process.env.WASABI_MEDIA_BUCKET || 'the961-media',
      region: secret.WASABI_REGION || secret.region || process.env.WASABI_MEDIA_REGION || 'eu-south-1',
      endpoint: secret.WASABI_ENDPOINT || secret.endpoint || process.env.WASABI_MEDIA_ENDPOINT || 'https://s3.eu-south-1.wasabisys.com'
    };
  }
  return {
    accessKeyId: process.env.WASABI_MEDIA_ACCESS_KEY_ID || 'mock-wasabi-access-key',
    secretAccessKey: process.env.WASABI_MEDIA_SECRET_ACCESS_KEY || 'mock-wasabi-secret-key',
    bucket: process.env.WASABI_MEDIA_BUCKET || 'the961-media',
    region: process.env.WASABI_MEDIA_REGION || 'eu-south-1',
    endpoint: process.env.WASABI_MEDIA_ENDPOINT || 'https://s3.eu-south-1.wasabisys.com'
  };
}

async function getPublishingCredentials() {
  const secret = await getSecret(process.env.PUBLISH_SECRET_NAME || 'PUBLISH_CREDENTIALS');
  if (typeof secret === 'object' && secret !== null) return secret;
  return { socialApiKey: process.env.SOCIAL_API_KEY || 'mock-social-api-key', renderApiKey: process.env.RENDER_API_KEY || 'mock-render-api-key' };
}

function clearCache() { secretCache.clear(); }

module.exports = { getSecret, getAppSecret, getAppSecretField, getGeminiApiKey, getWasabiCredentials, getMediaWasabiCredentials, getPublishingCredentials, clearCache };
