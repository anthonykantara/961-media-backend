const { getSocialSecrets } = require('../services/secrets');

/**
 * LinkedIn Integration Worker:
 * Interacts with LinkedIn UGC Post API (POST /v2/ugcPosts) sending social_summary and published website link.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional configuration overrides.
 * @returns {Promise<object>} LinkedIn API response.
 */
async function linkedinDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { accessToken, authorUrn } = secrets.linkedin;

  if (!accessToken || !authorUrn) {
    throw new Error('LinkedIn Dispatch Error: Missing LinkedIn accessToken or authorUrn.');
  }

  const socialSummary = article.social_summary || article.socialSummary || article.summary || article.title || '';
  const websiteBase = options.websiteUrl || process.env.WEBSITE_URL || 'https://961.co';
  const websiteLink = article.websiteLink || article.link || `${websiteBase}/articles/${article.id || ''}`;

  const fetchImpl = options.fetch || globalThis.fetch;

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

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();

  if (!response.ok || (resJson && resJson.message && !resJson.id)) {
    const errorMsg = resJson.message || response.statusText;
    throw new Error(`LinkedIn API Error (${response.status}): ${errorMsg}`);
  }

  return {
    success: true,
    postId: resJson.id,
    response: resJson
  };
}

module.exports = {
  linkedinDispatch
};
