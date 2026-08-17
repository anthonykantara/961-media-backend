const { getSocialSecrets } = require('../services/secrets');
const articleStore = require('../models/articleStore');
const { cmsDispatch } = require('./cmsDispatch');
const { facebookDispatch } = require('./facebookDispatch');
const { linkedinDispatch } = require('./linkedinDispatch');
const { slackDispatch } = require('./slackDispatch');
const { wasabiCleanup } = require('./wasabiCleanup');

/**
 * Orchestrates background dispatch workers for CMS database publishing and social media distribution.
 * 
 * @param {string|object} articleInput Article object or Article ID.
 * @param {object} [options] Optional configuration, overrides, or mocks.
 * @returns {Promise<object>} Summary report of all dispatch operations.
 */
async function dispatchAll(articleInput, options = {}) {
  let article = typeof articleInput === 'object' ? articleInput : await articleStore.getArticleById(articleInput);

  if (!article) {
    throw new Error(`Dispatch Orchestrator Error: Article ${articleInput} not found.`);
  }

  // 1. First run CMS Dispatch to update status to 'published' and bind featured.jpg
  let cmsResult;
  try {
    const updatedArticle = await cmsDispatch(article, options.cmsOptions || {});
    article = updatedArticle;
    cmsResult = { status: 'fulfilled', value: updatedArticle };
  } catch (err) {
    cmsResult = { status: 'rejected', reason: err.message };
  }

  // Retrieve social credentials securely
  const secrets = options.secrets || await getSocialSecrets(options);

  // 2. Execute social distribution and storage cleanup workers concurrently
  const [facebookRes, linkedinRes, slackRes, wasabiRes] = await Promise.allSettled([
    facebookDispatch(article, secrets, options.facebookOptions || {}),
    linkedinDispatch(article, secrets, options.linkedinOptions || {}),
    slackDispatch(article, secrets, options.slackOptions || {}),
    wasabiCleanup(article, secrets, options.wasabiOptions || {})
  ]);

  const results = {
    articleId: article.id,
    dispatches: {
      cms: cmsResult,
      facebook: facebookRes,
      linkedin: linkedinRes,
      slack: slackRes,
      wasabi: wasabiRes
    }
  };

  return results;
}

module.exports = {
  dispatchAll
};
