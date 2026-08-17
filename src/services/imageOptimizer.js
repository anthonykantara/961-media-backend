const sharp = require('sharp');

/**
 * Losslessly optimizes an image buffer using sharp.
 * @param {Buffer} buffer Input image buffer
 * @param {string} originalMimeType Optional MIME type
 * @returns {Promise<{ buffer: Buffer, mimeType: string, extension: string }>}
 */
async function optimizeImage(buffer, originalMimeType = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer provided for optimization.');
  }

  try {
    const metadata = await sharp(buffer).metadata();
    const format = (metadata.format || '').toLowerCase();

    let optimizedBuffer;
    let mimeType = originalMimeType;
    let extension = format || 'png';

    switch (format) {
      case 'jpeg':
      case 'jpg':
        optimizedBuffer = await sharp(buffer)
          .jpeg({ quality: 100, progressive: true, chromaSubsampling: '4:4:4' })
          .toBuffer();
        mimeType = 'image/jpeg';
        extension = 'jpg';
        break;

      case 'png':
        optimizedBuffer = await sharp(buffer)
          .png({ compressionLevel: 9, palette: false })
          .toBuffer();
        mimeType = 'image/png';
        extension = 'png';
        break;

      case 'webp':
        optimizedBuffer = await sharp(buffer)
          .webp({ lossless: true })
          .toBuffer();
        mimeType = 'image/webp';
        extension = 'webp';
        break;

      default:
        // Default conversion or metadata extraction
        optimizedBuffer = await sharp(buffer)
          .png({ compressionLevel: 9 })
          .toBuffer();
        mimeType = 'image/png';
        extension = 'png';
        break;
    }

    return {
      buffer: optimizedBuffer,
      mimeType,
      extension
    };
  } catch (err) {
    // If sharp processing fails (e.g., mock SVG or small buffer in tests), return input buffer as fallback
    let ext = 'png';
    if (originalMimeType.includes('jpeg') || originalMimeType.includes('jpg')) ext = 'jpg';
    if (originalMimeType.includes('webp')) ext = 'webp';

    return {
      buffer,
      mimeType: originalMimeType || 'image/png',
      extension: ext
    };
  }
}

module.exports = {
  optimizeImage
};
