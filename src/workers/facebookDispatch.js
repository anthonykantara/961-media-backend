const { getSocialSecrets } = require('../services/secrets');

/**
 * Facebook Page Integration Worker:
 * Interacts with Meta Graph API (POST /{page-id}/feed) sending social_summary and published website link.
 * Enforces explicit request timeout and validates response status and body safely.
 * 
 * @param {object|string} article Article object or ID.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional configuration overrides (e.g., custom fetch for testing, timeout).
 * @returns {Promise<object>} Response from Meta Graph API.
 */
async function facebookDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { pageId, accessToken } = secrets.meta || {};

  if (!pageId || !accessToken) {
    throw new Error('Facebook Dispatch Error: Missing Meta Graph API pageId or accessToken.');
  }

  const socialSummary = article.social_summary || article.socialSummary || article.summary || article.title || '';
  const websiteBase = options.websiteUrl || process.env.WEBSITE_URL || 'https://961.co';
  const websiteLink = article.websiteLink || article.link || `${websiteBase}/articles/${article.id || ''}`;

  const fetchImpl = options.fetch || globalThis.fetch;
  const timeoutMs = options.timeout || 10000;

  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const bodyData = {
    message: socialSummary,
    link: websiteLink,
    access_token: accessToken
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData),
      signal: controller.signal
    });

    let resJson = null;

    // Validate Content-Type header if present
    const contentType = (response.headers && typeof response.headers.get === 'function')
      ? response.headers.get('content-type')
      : null;

    if (contentType && !contentType.includes('application/json')) {
      const textBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      throw new Error(`Facebook API Error (${response.status}): Non-JSON response received: ${textBody.slice(0, 200)}`);
    }

    if (typeof response.json === 'function') {
      try {
        resJson = await response.json();
      } catch (parseErr) {
        const textBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
        throw new Error(`Facebook API Error (${response.status}): Invalid JSON response: ${textBody.slice(0, 200) || parseErr.message}`);
      }
    }

    if (!response.ok || (resJson && resJson.error)) {
      const errorMsg = (resJson && resJson.error)
        ? (typeof resJson.error === 'object' ? resJson.error.message : resJson.error)
        : (response.statusText || 'Request failed');
      throw new Error(`Facebook API Error (${response.status}): ${errorMsg}`);
    }

    return {
      success: true,
      postId: resJson ? resJson.id : null,
      response: resJson
    };
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Facebook API Error: Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  facebookDispatch
};
