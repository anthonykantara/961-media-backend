/**
 * Utility for generating concise, clean, and SEO-optimized permalinks/slugs from titles or inputs.
 * Removes special characters, accents, leading/trailing hyphens, duplicate hyphens,
 * and handles non-ASCII and multi-language titles cleanly.
 */

/**
 * Generates a clean, SEO-optimized permalink/slug string.
 * @param {string} input Title or raw permalink input string.
 * @returns {string} Clean permalink string.
 */
function generatePermalink(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return 'untitled';
  }

  let slug = input
    // Decompose accents and diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Lowercase
    .toLowerCase()
    // Replace non-alphanumeric characters (preserving Unicode letters, numbers, spaces, and hyphens)
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    // Replace spaces and underscores with a single hyphen
    .replace(/[\s_]+/g, '-')
    // Replace multiple consecutive hyphens with a single hyphen
    .replace(/-+/g, '-')
    // Trim leading and trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Truncate to a maximum reasonable length (100 characters) at word boundary if needed
  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-[^-]*$/, '');
    // Trim any trailing hyphens after truncation
    slug = slug.replace(/-+$/g, '');
  }

  return slug || 'untitled';
}

/**
 * Generates slug (alias of generatePermalink)
 */
const generateSlug = generatePermalink;

module.exports = {
  generatePermalink,
  generateSlug
};
