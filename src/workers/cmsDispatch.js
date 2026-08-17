const articleStore = require('../models/articleStore');

/**
 * CMS Database Dispatch Worker:
 * Updates the post status to 'published' and binds featured.jpg (or custom thumbnail) as the post thumbnail.
 * 
 * @param {string|object} articleInput Article ID or Article object.
 * @param {object} [options={}] Additional dispatch parameters.
 * @returns {Promise<object>} The updated article record.
 */
async function cmsDispatch(articleInput, options = {}) {
  const articleId = typeof articleInput === 'object' ? articleInput.id : articleInput;

  if (!articleId) {
    throw new Error('CMS Dispatch Error: Article ID is required.');
  }

  const existingArticle = await articleStore.getArticleById(articleId);
  if (!existingArticle) {
    throw new Error(`CMS Dispatch Error: Article with ID ${articleId} not found.`);
  }

  // Determine thumbnail binding (defaults to featured.jpg as per requirement)
  const thumbnail = options.thumbnail || options.featuredImage || existingArticle.featuredImage || existingArticle.image || existingArticle.imageUrl || 'featured.jpg';

  const updateData = {
    status: 'published',
    image: thumbnail,
    imageUrl: thumbnail
  };

  const updatedArticle = await articleStore.updateArticle(articleId, updateData);
  return updatedArticle;
}

module.exports = {
  cmsDispatch
};
