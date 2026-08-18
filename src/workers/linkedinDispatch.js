const { getSocialSecrets } = require('../services/secrets');

/**
 * LinkedIn Integration Worker:
 * Interacts with LinkedIn UGC Post API (POST /v2/ugcPosts) sending social_summary and published website link.
 * Enforces explicit request timeout and validates response status and body safely.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional configuration overrides (e.g., fetch, timeout).
 * @returns {Promise<object>} LinkedIn API response.
 */
async function linkedinDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { accessToken, authorUrn } = secrets.linkedin || {};

  if (!accessToken || !authorUrn) {
    throw new Error('LinkedIn Dispatch Error: Missing LinkedIn accessToken or authorUrn.');
  }

  const socialSummary = article.social_summary || article.socialSummary || article.summary || article.title || '';
  const websiteBase = options.websiteUrl || process.env.WEBSITE_URL || 'https://961.co';
  const websiteLink = article.websiteLink || article.link || `${websiteBase}/articles/${article.id || ''}`;

  const fetchImpl = options.fetch || globalThis.fetch;
  const timeoutMs = options.timeout || 10000;

  const url = 'https://api.linkedin.com/v2/ugcPosts';
  const payload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: socialSummary
        },
        shareMediaCategory: 'ARTICLE',
        media: [
          {
            status: 'READY',
            originalUrl: websiteLink,
            title: {
              text: article.title || socialSummary
            }
          }
        ]
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let resJson = null;

    // Validate Content-Type header if present
    const contentType = (response.headers && typeof response.headers.get === 'function')
      ? response.headers.get('content-type')
      : null;

    if (contentType && !contentType.includes('application/json')) {
      const textBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      throw new Error(`LinkedIn API Error (${response.status}): Non-JSON response received: ${textBody.slice(0, 200)}`);
    }

    if (typeof response.json === 'function') {
      try {
        resJson = await response.json();
      } catch (parseErr) {
        const textBody = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
        throw new Error(`LinkedIn API Error (${response.status}): Invalid JSON response: ${textBody.slice(0, 200) || parseErr.message}`);
      }
    }

    if (!response.ok || (resJson && resJson.message && !resJson.id)) {
      const errorMsg = (resJson && resJson.message) ? resJson.message : (response.statusText || 'Request failed');
      throw new Error(`LinkedIn API Error (${response.status}): ${errorMsg}`);
    }

    return {
      success: true,
      postId: resJson ? resJson.id : null,
      response: resJson
    };
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`LinkedIn API Error: Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  linkedinDispatch
};
