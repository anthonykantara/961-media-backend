const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let secretsCache = {};

/**
 * Clears in-memory secrets cache (primarily for testing).
 */
function clearSecretsCache() {
  secretsCache = {};
}

/**
 * Fetches secret string or JSON object from AWS Secrets Manager with fallback to process.env.
 * @param {string} secretName Name or ARN of the secret in AWS Secrets Manager.
 * @param {object} options Options including region or mock client override.
 * @returns {Promise<object|string|null>} Parsed secret value or raw string.
 */
async function getSecretValue(secretName, options = {}) {
  if (secretsCache[secretName] && !options.skipCache) {
    return secretsCache[secretName];
  }

  const region = options.region || process.env.AWS_REGION || 'us-east-1';

  try {
    const client = options.client || new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response && response.SecretString) {
      try {
        const parsed = JSON.parse(response.SecretString);
        secretsCache[secretName] = parsed;
        return parsed;
      } catch (e) {
        secretsCache[secretName] = response.SecretString;
        return response.SecretString;
      }
    }
  } catch (err) {
    // Failover gracefully to environment variables or cached values if AWS call fails
  }

  return null;
}

/**
 * Retrieves all required social distribution and CMS secrets, falling back to process.env.
 * @param {object} options Optional overrides and mock client settings.
 * @returns {Promise<object>} Combined secrets object for Meta, LinkedIn, Slack, and Wasabi.
 */
async function getSocialSecrets(options = {}) {
  const secretName = options.secretName || process.env.AWS_SECRET_NAME || 'prod/social-dispatch/keys';
  const awsSecret = await getSecretValue(secretName, options);

  const env = process.env;
  const sec = awsSecret || {};

  return {
    meta: {
      accessToken: sec.META_ACCESS_TOKEN || sec.metaAccessToken || env.META_ACCESS_TOKEN || '',
      pageId: sec.FACEBOOK_PAGE_ID || sec.facebookPageId || env.FACEBOOK_PAGE_ID || ''
    },
    linkedin: {
      accessToken: sec.LINKEDIN_ACCESS_TOKEN || sec.linkedinAccessToken || env.LINKEDIN_ACCESS_TOKEN || '',
      authorUrn: sec.LINKEDIN_AUTHOR_URN || sec.linkedinAuthorUrn || env.LINKEDIN_AUTHOR_URN || ''
    },
    slack: {
      botToken: sec.SLACK_BOT_TOKEN || sec.slackBotToken || env.SLACK_BOT_TOKEN || '',
      channel: sec.SLACK_CHANNEL || sec.slackChannel || env.SLACK_CHANNEL || '#ig-staging'
    },
    wasabi: {
      accessKeyId: sec.WASABI_ACCESS_KEY_ID || sec.wasabiAccessKeyId || env.WASABI_ACCESS_KEY_ID || '',
      secretAccessKey: sec.WASABI_SECRET_ACCESS_KEY || sec.wasabiSecretAccessKey || env.WASABI_SECRET_ACCESS_KEY || '',
      bucket: sec.WASABI_BUCKET || sec.wasabiBucket || env.WASABI_BUCKET || '961-media-drafts',
      region: sec.WASABI_REGION || sec.wasabiRegion || env.WASABI_REGION || 'us-east-1',
      endpoint: sec.WASABI_ENDPOINT || sec.wasabiEndpoint || env.WASABI_ENDPOINT || 'https://s3.wasabisys.com'
    }
  };
}

module.exports = {
  getSecretValue,
  getSocialSecrets,
  clearSecretsCache
};
