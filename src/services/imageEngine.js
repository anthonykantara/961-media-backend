const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const wasabiService = require('./wasabiService');

const BRAND_RED = '#FF0000';
const TEXT_WHITE = '#FFFFFF';
const DEFAULT_CDN_BASE = 'https://media.the961.com';

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

function getWordWidth(word, fontSize) {
  let width = 0;
  for (let i = 0; i < word.length; i++) width += getCharWidth(word[i], fontSize);
  return width;
}

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
    for (const w of keyword.split(/\s+/)) {
      if (w) tokens.push({ word: w, color });
    }
  }
  return tokens;
}

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
    } else if (currentLineWidth + spaceWidth + wWidth <= maxWidth) {
      currentLine.push({ ...token, width: wWidth });
      currentLineWidth += spaceWidth + wWidth;
    } else {
      lines.push(currentLine);
      currentLine = [{ ...token, width: wWidth }];
      currentLineWidth = wWidth;
    }
  }
  if (currentLine.length) lines.push(currentLine);
  return { lines, spaceWidth };
}

function buildTspans(lineTokens, shadow = false) {
  let svgStr = '';
  for (let j = 0; j < lineTokens.length; j++) {
    const token = lineTokens[j];
    const space = j === lineTokens.length - 1 ? '' : ' ';
    const textContent = escapeXml(`${token.word}${space}`);
    svgStr += shadow
      ? `<tspan fill="#000000" fill-opacity="0.75">${textContent}</tspan>`
      : `<tspan fill="${token.color}">${textContent}</tspan>`;
  }
  return svgStr;
}

async function createFallbackCanvas(width = 1200, height = 1200) {
  const svg = `<svg width="${width}" height="${height}"><defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e202a" /><stop offset="100%" stop-color="#2a324b" /></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#bgGrad)" /></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function loadInputImage(inputSource) {
  if (!inputSource) return createFallbackCanvas();
  if (Buffer.isBuffer(inputSource)) return inputSource;
  if (typeof inputSource === 'string') {
    if (inputSource.startsWith('data:image/') || inputSource.includes(';base64,')) {
      try { return Buffer.from(inputSource.split(';base64,').pop(), 'base64'); } catch (_) {}
    }
    if (inputSource.startsWith('http://') || inputSource.startsWith('https://')) {
      try {
        const res = await fetch(inputSource);
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      } catch (_) {}
    }
    if (fs.existsSync(inputSource)) {
      try { return await fs.promises.readFile(inputSource); } catch (_) {}
    }
  }
  return createFallbackCanvas();
}

async function enhanceImage(inputBuffer) {
  try {
    return await sharp(inputBuffer).rotate().modulate({ saturation: 1.15 }).linear(1.18, -23.04).toBuffer();
  } catch (_) {
    return inputBuffer;
  }
}

async function renderFeaturedImage(baseBuffer, headline) {
  try {
    const canvasW = 1200;
    const canvasH = 630;
    const scaledBuffer = await sharp(baseBuffer).resize(canvasW, canvasH, { fit: 'cover', position: 'center' }).toBuffer();
    const tokens = parseTextTokens(headline || 'Discover [961] Media Highlights');
    const fontSize = 52;
    const marginX = 70;
    const lineStep = fontSize + 16;
    const { lines } = wrapTokensIntoLines(tokens, fontSize, canvasW - marginX * 2);
    const totalTextHeight = lines.length * lineStep;
    let startY = canvasH - totalTextHeight - 70;
    if (startY < 50) startY = 50;
    let svgContent = `<svg width="${canvasW}" height="${canvasH}"><defs><linearGradient id="overlayGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000000" stop-opacity="0" /><stop offset="100%" stop-color="#000000" stop-opacity="0.82" /></linearGradient></defs><rect x="0" y="220" width="${canvasW}" height="410" fill="url(#overlayGrad)" />`;
    lines.forEach((lineTokens, i) => {
      const lineY = startY + (i + 1) * lineStep - 14;
      svgContent += `<text x="${marginX + 2}" y="${lineY + 2}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">${buildTspans(lineTokens, true)}</text>`;
      svgContent += `<text x="${marginX}" y="${lineY}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">${buildTspans(lineTokens, false)}</text>`;
    });
    svgContent += '</svg>';
    return sharp(scaledBuffer).composite([{ input: Buffer.from(svgContent) }]).jpeg({ quality: 92 }).toBuffer();
  } catch (_) {
    try { return sharp(baseBuffer).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer(); } catch (_) { return baseBuffer; }
  }
}

async function renderCarouselDeck(baseBuffer, carouselSlides) {
  const canvasW = 1080;
  const canvasH = 1350;
  let slidesContent = Array.isArray(carouselSlides) ? [...carouselSlides] : [];
  slidesContent = slidesContent.map(s => typeof s === 'object' && s !== null ? (s.text || s.content || String(s)) : String(s));
  const defaults = [
    'Discover the [latest news] from 961 Media',
    'Explore [exclusive stories] updated daily',
    'Join our [vibrant community] across Lebanon',
    'Stay tuned for [more updates] coming soon'
  ];
  if (!slidesContent.length) slidesContent = [...defaults];
  while (slidesContent.length < 4) slidesContent.push(slidesContent[slidesContent.length - 1] || defaults[slidesContent.length]);
  slidesContent = slidesContent.slice(0, 4);
  let scaledBuffer;
  try { scaledBuffer = await sharp(baseBuffer).resize(canvasW, canvasH, { fit: 'cover', position: 'center' }).toBuffer(); } catch (_) { scaledBuffer = baseBuffer; }
  const outputBuffers = [];
  for (let idx = 0; idx < 4; idx++) {
    try {
      const tokens = parseTextTokens(slidesContent[idx]);
      const fontSize = 52;
      const marginX = 80;
      const lineStep = fontSize + 20;
      const { lines } = wrapTokensIntoLines(tokens, fontSize, canvasW - marginX * 2);
      const totalTextHeight = lines.length * lineStep;
      const startY = Math.floor((canvasH - totalTextHeight) / 2);
      let svgContent = `<svg width="${canvasW}" height="${canvasH}"><rect width="${canvasW}" height="${canvasH}" fill="#000000" fill-opacity="0.4" />`;
      lines.forEach((lineTokens, i) => {
        const lineY = startY + (i + 1) * lineStep - 16;
        svgContent += `<text x="${marginX + 2}" y="${lineY + 2}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">${buildTspans(lineTokens, true)}</text>`;
        svgContent += `<text x="${marginX}" y="${lineY}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="bold" font-size="${fontSize}">${buildTspans(lineTokens, false)}</text>`;
      });
      const cy = Math.floor(canvasH / 2);
      if (idx > 0) svgContent += `<circle cx="60" cy="${cy}" r="24" fill="#000000" fill-opacity="0.6" /><polyline points="66,${cy - 12} 54,${cy} 66,${cy + 12}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
      if (idx < 3) svgContent += `<circle cx="1020" cy="${cy}" r="24" fill="#000000" fill-opacity="0.6" /><polyline points="1014,${cy - 12} 1026,${cy} 1014,${cy + 12}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`;
      svgContent += `<text x="540" y="1280" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF" fill-opacity="0.7">${idx + 1} / 4</text></svg>`;
      outputBuffers.push(await sharp(scaledBuffer).composite([{ input: Buffer.from(svgContent) }]).png().toBuffer());
    } catch (_) {
      outputBuffers.push(await sharp(baseBuffer).resize(canvasW, canvasH, { fit: 'cover' }).png().toBuffer());
    }
  }
  return outputBuffers;
}

async function processExpressCreation(payload = {}) {
  const jobId = payload.job_id || payload.article_id || crypto.randomUUID();
  const rawInput = payload.image || payload.imageUrl || payload.image_path || payload.raw_image;
  const headline = payload.headline || payload.title || 'Discover [961] Media Highlights';
  const carouselSlides = payload.carousel_slides || [];
  const cdnBase = (process.env.MEDIA_CDN_URL || process.env.CLOUDFLARE_CDN_URL || process.env.CDN_BASE_URL || DEFAULT_CDN_BASE).replace(/\/+$/, '');
  const outputDir = payload.output_dir || path.join(os.tmpdir(), 'express_creation', jobId);
  await fs.promises.mkdir(outputDir, { recursive: true });

  try {
    const rawBuffer = await loadInputImage(rawInput);
    const enhancedBuffer = await enhanceImage(rawBuffer);
    const featuredBuffer = await renderFeaturedImage(enhancedBuffer, headline);
    const featuredFilename = 'featured.jpg';
    const featuredStoragePath = `express-creation/${jobId}/${featuredFilename}`;
    await fs.promises.writeFile(path.join(outputDir, featuredFilename), featuredBuffer);
    await wasabiService.uploadToWasabi(featuredBuffer, featuredStoragePath, 'image/jpeg');
    const featuredCdnUrl = `${cdnBase}/${featuredStoragePath}`;

    const carouselBuffers = await renderCarouselDeck(enhancedBuffer, carouselSlides);
    const carouselSlidesResult = [];
    const carouselCdnList = [];
    for (let idx = 0; idx < 4; idx++) {
      const filename = `carousel_${idx + 1}.png`;
      const storagePath = `express-creation/${jobId}/${filename}`;
      const localPath = path.join(outputDir, filename);
      await fs.promises.writeFile(localPath, carouselBuffers[idx]);
      await wasabiService.uploadToWasabi(carouselBuffers[idx], storagePath, 'image/png');
      const cdnUrl = `${cdnBase}/${storagePath}`;
      carouselCdnList.push(cdnUrl);
      carouselSlidesResult.push({ slide: idx + 1, url: cdnUrl, storage_path: storagePath, local_path: localPath, dimensions: { width: 1080, height: 1350 }, format: 'PNG' });
    }

    return {
      status: 'success',
      job_id: jobId,
      featured_image: { url: featuredCdnUrl, storage_path: featuredStoragePath, local_path: path.join(outputDir, featuredFilename), dimensions: { width: 1200, height: 630 }, format: 'JPG' },
      carousel_slides: carouselSlidesResult,
      cdn_urls: { featured: featuredCdnUrl, carousel: carouselCdnList }
    };
  } catch (err) {
    console.error('Express Creation processing error:', err);
    throw err;
  }
}

module.exports = { processExpressCreation, enhanceImage, renderFeaturedImage, renderCarouselDeck };
