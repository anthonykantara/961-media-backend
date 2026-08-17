const { getSocialSecrets } = require('../services/secrets');

/**
 * Facebook Page Integration Worker:
 * Interacts with Meta Graph API (POST /{page-id}/feed) sending social_summary and published website link.
 * 
 * @param {object|string} article Article object or ID.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional configuration overrides (e.g., custom fetch for testing).
 * @returns {Promise<object>} Response from Meta Graph API.
 */
async function facebookDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { pageId, accessToken } = secrets.meta;

  if (!pageId || !accessToken) {
    throw new Error('Facebook Dispatch Error: Missing Meta Graph API pageId or accessToken.');
  }

  const socialSummary = article.social_summary || article.socialSummary || article.summary || article.title || '';
  const websiteBase = options.websiteUrl || process.env.WEBSITE_URL || 'https://961.co';
  const websiteLink = article.websiteLink || article.link || `${websiteBase}/articles/${article.id || ''}`;

  const fetchImpl = options.fetch || globalThis.fetch;

  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const bodyData = {
    message: socialSummary,
    link: websiteLink,
    access_token: accessToken
  };

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyData)
  });

  const resJson = await response.json();

  if (!response.ok || resJson.error) {
    const errorMsg = resJson.error ? resJson.error.message : response.statusText;
    throw new Error(`Facebook API Error (${response.status}): ${errorMsg}`);
  }

  return {
    success: true,
    postId: resJson.id,
    response: resJson
  };
}

module.exports = {
  facebookDispatch
};
