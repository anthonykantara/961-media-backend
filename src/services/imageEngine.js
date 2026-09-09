const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const wasabiService = require('./wasabiService');

// --- Constants & Default Settings ---
const BRAND_RED = '#FF0000';
const TEXT_WHITE = '#FFFFFF';
const DEFAULT_CDN_BASE = 'https://cdn.961.co';

/**
 * Safely escapes XML special characters for SVG rendering.
 * @param {string} unsafe Input string
 * @returns {string} Escaped string
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Estimate character width in pixels for bold sans-serif fonts.
 * @param {string} ch Character
 * @param {number} fontSize Font size
 * @returns {number} Estimated width
 */
function getCharWidth(ch, fontSize) {
  if (/[i1l!':;.,|`\-\(\)\[\]]/.test(ch)) return fontSize * 0.28;
  if (/[rftjI]/.test(ch)) return fontSize * 0.38;
  if (/[MW@#%]/.test(ch)) return fontSize * 0.82;
  if (/[m]/.test(ch)) return fontSize * 0.72;
  if (/[w]/.test(ch)) return fontSize * 0.68;
  if (/[A-Z0-9]/.test(ch)) return fontSize * 0.65;
  if (ch === ' ') return fontSize * 0.32;
  return fontSize * 0.54;
}

/**
 * Calculates total width of a word string.
 * @param {string} word Word
 * @param {number} fontSize Font size
 * @returns {number} Width in pixels
 */
function getWordWidth(word, fontSize) {
  let width = 0;
  for (let i = 0; i < word.length; i++) {
    width += getCharWidth(word[i], fontSize);
  }
  return width;
}

/**
 * Parses text containing bracketed keywords r"\[(.*?)\]" into word tokens with brand red / white colors.
 * @param {string} text Input headline or slide text
 * @returns {Array<{ word: string, color: string }>} Word tokens
 */
function parseTextTokens(text) {
  if (!text) return [];
  const segments = String(text).split(/(\[.*?\])/g);
  const tokens = [];

  for (const seg of segments) {
    if (!seg) continue;
    let keyword = seg;
    let color = TEXT_WHITE;

    if (seg.startsWith('[') && seg.endsWith(']')) {
      keyword = seg.slice(1, -1);
      color = BRAND_RED;
    }

    const words = keyword.split(/\s+/);
    for (const w of words) {
      if (w) {
        tokens.push({ word: w, color });
      }
    }
  }

  return tokens;
}

/**
 * Wraps tokens into lines based on maximum line width.
 * @param {Array<{ word: string, color: string }>} tokens Word tokens
 * @param {number} fontSize Font size
 * @param {number} maxWidth Maximum text width in pixels
 * @returns {{ lines: Array<Array<{ word: string, color: string, width: number }>>, spaceWidth: number }}
 */
function wrapTokensIntoLines(tokens, fontSize, maxWidth) {
  const spaceWidth = fontSize * 0.32;
  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  for (const token of tokens) {
    const wWidth = getWordWidth(token.word, fontSize);

    if (currentLine.length === 0) {
      currentLine.push({ ...token, width: wWidth });
      currentLineWidth = wWidth;
    } else {
      const testWidth = currentLineWidth + spaceWidth + wWidth;
      if (testWidth <= maxWidth) {
        currentLine.push({ ...token, width: wWidth });
        currentLineWidth = testWidth;
      } else {
        lines.push(currentLine);
        currentLine = [{ ...token, width: wWidth }];
        currentLineWidth = wWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return { lines, spaceWidth };
}

/**
 * Builds SVG <tspan> elements for a line of tokens.
 * @param {Array<{ word: string, color: string }>} lineTokens Line tokens
 * @param {boolean} shadow Whether generating shadow elements
 * @returns {string} Inner SVG string
 */
function buildTspans(lineTokens, shadow = false) {
  let svgStr = '';
  for (let j = 0; j < lineTokens.length; j++) {
    const token = lineTokens[j];
    const isLast = j === lineTokens.length - 1;
    const space = isLast ? '' : ' ';
    const textContent = escapeXml(`${token.word}${space}`);

    if (shadow) {
      svgStr += `<tspan fill="#000000" fill-opacity="0.75">${textContent}</tspan>`;
    } else {
      svgStr += `<tspan fill="${token.color}">${textContent}</tspan>`;
    }
  }
  return svgStr;
}

/**
 * Generates a fallback dark background image buffer.
 * @param {number} width Width in pixels
 * @param {number} height Height in pixels
 * @returns {Promise<Buffer>} PNG Buffer
 */
async function createFallbackCanvas(width = 1200, height = 1200) {
  const svg = `<svg width="${width}" height="${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e202a" />
        <stop offset="100%" stop-color="#2a324b" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Loads raw input image from Buffer, data URL, http/https URL, or file path.
 * @param {string|Buffer} inputSource Image source
 * @returns {Promise<Buffer>} Image buffer
 */
async function loadInputImage(inputSource) {
  if (!inputSource) {
    return await createFallbackCanvas();
  }

  if (Buffer.isBuffer(inputSource)) {
    return inputSource;
  }

  if (typeof inputSource === 'string') {
    // 1. Data URL or base64
    if (inputSource.startsWith('data:image/') || inputSource.includes(';base64,')) {
      try {
        const base64Data = inputSource.split(';base64,').pop();
        return Buffer.from(base64Data, 'base64');
      } catch (err) {
        console.warn('Failed to decode base64 image source:', err.message);
      }
    }

    // 2. HTTP / HTTPS URL
    if (inputSource.startsWith('http://') || inputSource.startsWith('https://')) {
      try {
        const res = await fetch(inputSource);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
      } catch (err) {
        console.warn(`Failed to fetch image from URL [${inputSource}]:`, err.message);
      }
    }

    // 3. Local file path
    if (fs.existsSync(inputSource)) {
      try {
        return await fs.promises.readFile(inputSource);
      } catch (err) {
        console.warn(`Failed to read image file [${inputSource}]:`, err.message);
      }
    }
  }

  return await createFallbackCanvas();
}

/**
 * Step 1: Applies enhancement pass (+18% contrast, +15% saturation) on raw image buffer.
 * @param {Buffer} inputBuffer Image buffer
 * @returns {Promise<Buffer>} Enhanced buffer
 */
async function enhanceImage(inputBuffer) {
  try {
    return await sharp(inputBuffer)
      .rotate()
      .modulate({ saturation: 1.15 })
      .linear(1.18, -23.04)
      .toBuffer();
  } catch (err) {
    console.warn('Enhancement pass failed, falling back to original source buffer:', err.message);
    return inputBuffer;
  }
}

/**
 * Step 2: Renders Website Featured Image (1200x630 JPG) with dynamically wrapped bracketed text.
 * @param {Buffer} baseBuffer Enhanced image buffer
 * @param {string} headline Headline text
 * @returns {Promise<Buffer>} Rendered JPG Buffer
 */
async function renderFeaturedImage(baseBuffer, headline) {
  try {
    const canvasW = 1200;
    const canvasH = 630;

    const scaledBuffer = await sharp(baseBuffer)
      .resize(canvasW, canvasH, { fit: 'cover', position: 'center' })
      .toBuffer();

    const parsedHeadline = headline || 'Discover [961] Media Highlights';
    const tokens = parseTextTokens(parsedHeadline);
    const fontSize = 52;
    const marginX = 70;
    const maxTextWidth = canvasW - marginX * 2; // 1060px
    const lineSpacing = 16;
    const lineStep = fontSize + lineSpacing; // 68px

    const { lines } = wrapTokensIntoLines(tokens, fontSize, maxTextWidth);
    const totalTextHeight = lines.length * lineStep;

    let startY = canvasH - totalTextHeight - 70;
    if (startY < 50) startY = 50;

    let svgContent = `<svg width="${canvasW}" height="${canvasH}">
      <defs>
        <linearGradient id="overlayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.82" />
        </linearGradient>
      </defs>
      <rect x="0" y="220" width="${canvasW}" height="410" fill="url(#overlayGrad)" />`;

    lines.forEach((lineTokens, i) => {
      const lineY = startY + (i + 1) * lineStep - 14;

      // Drop shadow text
      svgContent += `
      <text x="${marginX + 2}" y="${lineY + 2}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">
        ${buildTspans(lineTokens, true)}
      </text>`;

      // Main text
      svgContent += `
      <text x="${marginX}" y="${lineY}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">
        ${buildTspans(lineTokens, false)}
      </text>`;
    });

    svgContent += `</svg>`;

    return await sharp(scaledBuffer)
      .composite([{ input: Buffer.from(svgContent) }])
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (err) {
    console.warn('Featured image render failed, falling back to source buffer:', err.message);
    try {
      return await sharp(baseBuffer)
        .resize(1200, 630, { fit: 'cover' })
        .jpeg({ quality: 92 })
        .toBuffer();
    } catch (fallbackErr) {
      return baseBuffer;
    }
  }
}

/**
 * Step 3: Renders Instagram Carousel Deck (1080x1350 PNGs x 4).
 * @param {Buffer} baseBuffer Enhanced image buffer
 * @param {Array<string|Object>} carouselSlides Carousel slide texts
 * @returns {Promise<Array<Buffer>>} Array of 4 PNG Buffers
 */
async function renderCarouselDeck(baseBuffer, carouselSlides) {
  const canvasW = 1080;
  const canvasH = 1350;

  let slidesContent = Array.isArray(carouselSlides) ? [...carouselSlides] : [];
  slidesContent = slidesContent.map((s) => {
    if (typeof s === 'object' && s !== null) {
      return s.text || s.content || String(s);
    }
    return String(s);
  });

  const defaultSlides = [
    'Discover the [latest news] from 961 Media',
    'Explore [exclusive stories] updated daily',
    'Join our [vibrant community] across Lebanon',
    'Stay tuned for [more updates] coming soon'
  ];

  if (slidesContent.length === 0) {
    slidesContent = [...defaultSlides];
  }

  while (slidesContent.length < 4) {
    slidesContent.push(slidesContent[slidesContent.length - 1] || defaultSlides[slidesContent.length]);
  }
  slidesContent = slidesContent.slice(0, 4);

  let scaledBuffer;
  try {
    scaledBuffer = await sharp(baseBuffer)
      .resize(canvasW, canvasH, { fit: 'cover', position: 'center' })
      .toBuffer();
  } catch (e) {
    scaledBuffer = baseBuffer;
  }

  const outputBuffers = [];

  for (let idx = 0; idx < 4; idx++) {
    const slideText = slidesContent[idx];
    try {
      const tokens = parseTextTokens(slideText);
      const fontSize = 52;
      const marginX = 80;
      const maxTextWidth = canvasW - marginX * 2; // 920px
      const lineSpacing = 20;
      const lineStep = fontSize + lineSpacing; // 72px

      const { lines } = wrapTokensIntoLines(tokens, fontSize, maxTextWidth);
      const totalTextHeight = lines.length * lineStep;
      const startY = Math.floor((canvasH - totalTextHeight) / 2);

      let svgContent = `<svg width="${canvasW}" height="${canvasH}">
        <!-- 40% Dark tint overlay -->
        <rect width="${canvasW}" height="${canvasH}" fill="#000000" fill-opacity="0.4" />`;

      lines.forEach((lineTokens, i) => {
        const lineY = startY + (i + 1) * lineStep - 16;

        // Drop shadow text
        svgContent += `
        <text x="${marginX + 2}" y="${lineY + 2}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">
          ${buildTspans(lineTokens, true)}
        </text>`;

        // Main text
        svgContent += `
        <text x="${marginX}" y="${lineY}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">
          ${buildTspans(lineTokens, false)}
        </text>`;
      });

      // Navigation arrow icons
      const cy = Math.floor(canvasH / 2); // 675
      // Backward arrow on slides 2, 3, 4 (idx > 0)
      if (idx > 0) {
        svgContent += `
        <circle cx="60" cy="${cy}" r="24" fill="#000000" fill-opacity="0.6" />
        <polyline points="66,${cy - 12} 54,${cy} 66,${cy + 12}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
      }

      // Forward arrow on slides 1, 2, 3 (idx < 3)
      if (idx < 3) {
        svgContent += `
        <circle cx="1020" cy="${cy}" r="24" fill="#000000" fill-opacity="0.6" />
        <polyline points="1014,${cy - 12} 1026,${cy} 1014,${cy + 12}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
      }

      // Progress Badge
      svgContent += `
      <text x="540" y="1280" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF" fill-opacity="0.7">
        ${idx + 1} / 4
      </text>`;

      svgContent += `</svg>`;

      const slideBuf = await sharp(scaledBuffer)
        .composite([{ input: Buffer.from(svgContent) }])
        .png()
        .toBuffer();

      outputBuffers.push(slideBuf);
    } catch (err) {
      console.warn(`Carousel slide ${idx + 1} render failed, falling back to source buffer:`, err.message);
      try {
        const fallbackBuf = await sharp(baseBuffer)
          .resize(canvasW, canvasH, { fit: 'cover' })
          .png()
          .toBuffer();
        outputBuffers.push(fallbackBuf);
      } catch (fErr) {
        outputBuffers.push(baseBuffer);
      }
    }
  }

  return outputBuffers;
}

/**
 * Native Node.js In-Memory Express Creation Workflow Processing.
 * Executes image compositing, filter adjustments, and cloud storage uploads in-memory.
 * @param {Object} payload Payload containing headline, carousel_slides, image/imageUrl, job_id, etc.
 * @returns {Promise<Object>} Execution result containing CDN URLs and image details.
 */
async function processExpressCreation(payload = {}) {
  try {
    const jobId = payload.job_id || payload.article_id || crypto.randomUUID();
    const rawInput = payload.image || payload.imageUrl || payload.image_path || payload.raw_image;
    const headline = payload.headline || payload.title || 'Discover [961] Media Highlights';
    const carouselSlides = payload.carousel_slides || [];

    const cdnBase = (
      process.env.CLOUDFLARE_CDN_URL ||
      process.env.CDN_BASE_URL ||
      DEFAULT_CDN_BASE
    ).replace(/\/+$/, '');

    const outputDir = payload.output_dir || path.join(os.tmpdir(), 'express_creation', jobId);
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Step 0: Load raw upload image into memory
    const rawBuffer = await loadInputImage(rawInput);

    // Step 1: Enhancement Pass (+18% Contrast, +15% Saturation)
    const enhancedBuffer = await enhanceImage(rawBuffer);

    // Step 2: Website Featured Image (1200x630 JPG)
    const featuredBuffer = await renderFeaturedImage(enhancedBuffer, headline);
    const featuredFilename = 'featured.jpg';
    const featuredLocalPath = path.join(outputDir, featuredFilename);
    const featuredStoragePath = `express-creation/${jobId}/${featuredFilename}`;

    await fs.promises.writeFile(featuredLocalPath, featuredBuffer);
    await wasabiService.uploadToWasabi(featuredBuffer, featuredStoragePath, 'image/jpeg');

    const featuredCdnUrl = `${cdnBase}/${featuredStoragePath}`;

    // Step 3: Instagram Carousel Deck (1080x1350 PNGs x 4)
    const carouselBuffers = await renderCarouselDeck(enhancedBuffer, carouselSlides);

    const carouselSlidesResult = [];
    const carouselCdnList = [];

    for (let idx = 0; idx < 4; idx++) {
      const cBuffer = carouselBuffers[idx];
      const filename = `carousel_${idx + 1}.png`;
      const localPath = path.join(outputDir, filename);
      const storagePath = `express-creation/${jobId}/${filename}`;

      await fs.promises.writeFile(localPath, cBuffer);
      await wasabiService.uploadToWasabi(cBuffer, storagePath, 'image/png');

      const cdnUrl = `${cdnBase}/${storagePath}`;

      carouselCdnList.push(cdnUrl);
      carouselSlidesResult.push({
        slide: idx + 1,
        url: cdnUrl,
        storage_path: storagePath,
        local_path: localPath,
        dimensions: { width: 1080, height: 1350 },
        format: 'PNG'
      });
    }

    return {
      status: 'success',
      job_id: jobId,
      featured_image: {
        url: featuredCdnUrl,
        storage_path: featuredStoragePath,
        local_path: featuredLocalPath,
        dimensions: { width: 1200, height: 630 },
        format: 'JPG'
      },
      carousel_slides: carouselSlidesResult,
      cdn_urls: {
        featured: featuredCdnUrl,
        carousel: carouselCdnList
      }
    };
  } catch (err) {
    console.error('Express Creation processing error:', err);
    throw err;
  }
}

module.exports = {
  processExpressCreation,
  enhanceImage,
  renderFeaturedImage,
  renderCarouselDeck
};
