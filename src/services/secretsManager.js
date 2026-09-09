const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretCache = new Map();

/**
 * Retrieves a secret value by name from AWS Secrets Manager with caching and environment variable fallback.
 * @param {string} secretName Name of the secret or environment variable key
 * @returns {Promise<string|Object|null>} Secret string or parsed JSON object
 */
async function getSecret(secretName) {
  if (!secretName) return null;

  if (secretCache.has(secretName)) {
    return secretCache.get(secretName);
  }

  if (process.env[secretName]) {
    const envVal = process.env[secretName];
    try {
      const parsed = JSON.parse(envVal);
      secretCache.set(secretName, parsed);
      return parsed;
    } catch (e) {
      secretCache.set(secretName, envVal);
      return envVal;
    }
  }

  try {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const client = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      let secretValue;
      try {
        secretValue = JSON.parse(response.SecretString);
      } catch (e) {
        secretValue = response.SecretString;
      }
      secretCache.set(secretName, secretValue);
      return secretValue;
    }
  } catch (err) {
    if (process.env[secretName]) {
      return process.env[secretName];
    }
  }

  return null;
}

async function getGeminiApiKey() {
  const secret = await getSecret(process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY');
  if (typeof secret === 'object' && secret !== null) {
    return secret.GEMINI_API_KEY || secret.apiKey || secret.api_key || null;
  }
  return secret || process.env.GEMINI_API_KEY || 'mock-gemini-key';
}

/**
 * Helper for existing Wasabi Cloud Storage callers.
 * This profile is intentionally left unchanged for existing buckets/services.
 */
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

/**
 * Credentials for the dedicated 961 Media Library Wasabi bucket.
 * Defaults target the production Milan bucket while requiring explicit
 * credentials/bucket configuration through the media secret or environment.
 */
async function getMediaWasabiCredentials() {
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
  if (typeof secret === 'object' && secret !== null) {
    return secret;
  }
  return {
    socialApiKey: process.env.SOCIAL_API_KEY || 'mock-social-api-key',
    renderApiKey: process.env.RENDER_API_KEY || 'mock-render-api-key'
  };
}

function clearCache() {
  secretCache.clear();
}

module.exports = {
  getSecret,
  getGeminiApiKey,
  getWasabiCredentials,
  getMediaWasabiCredentials,
  getPublishingCredentials,
  clearCache
};
