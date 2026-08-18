const { WebClient } = require('@slack/web-api');
const { getSocialSecrets } = require('../services/secrets');

/**
 * Slack Webhook Dispatch Worker (#ig-staging):
 * Uploads all carousel_N.png files concurrently via files.uploadV2 and sends ig_caption
 * in a formatted markdown code block (` ```ig_caption``` `) using chat.postMessage.
 * Explicitly reports failure details if any uploads fail.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional overrides and mocks for testing.
 * @returns {Promise<object>} Status report with upload and message details.
 */
async function slackDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { botToken, channel } = secrets.slack || {};
  const targetChannel = options.channel || channel || '#ig-staging';

  if (!botToken && !options.slackClient) {
    throw new Error('Slack Dispatch Error: Missing Slack Bot Token.');
  }

  const client = options.slackClient || new WebClient(botToken);

  // Extract carousel files
  const carouselFiles = options.carouselFiles || article.carouselFiles || article.carousel_files || article.carouselImages || [];

  // 1. Upload all carousel files concurrently
  const uploadPromises = carouselFiles.map(async (fileInput) => {
    if (options.uploadV2Mock) {
      return await options.uploadV2Mock({ channel_id: targetChannel, fileInput });
    } else if (typeof fileInput === 'string') {
      return await client.files.uploadV2({
        channel_id: targetChannel,
        file: fileInput,
        filename: fileInput.split('/').pop() || 'carousel_N.png'
      });
    } else if (Buffer.isBuffer(fileInput) || typeof fileInput === 'object') {
      return await client.files.uploadV2({
        channel_id: targetChannel,
        file: fileInput.buffer || fileInput,
        filename: fileInput.filename || 'carousel_N.png'
      });
    }
    throw new Error(`Invalid file input format: ${typeof fileInput}`);
  });

  const uploadResults = await Promise.allSettled(uploadPromises);
  const uploadedFiles = [];
  const uploadErrors = [];

  uploadResults.forEach((res, index) => {
    if (res.status === 'fulfilled' && res.value) {
      uploadedFiles.push(res.value);
    } else if (res.status === 'rejected') {
      const fileIdentifier = typeof carouselFiles[index] === 'string' ? carouselFiles[index] : `file_${index + 1}`;
      const errDetail = res.reason && res.reason.message ? res.reason.message : String(res.reason);
      console.error(`Slack Carousel Upload Failure [${fileIdentifier}]:`, errDetail);
      uploadErrors.push({ file: fileIdentifier, error: errDetail });
    }
  });

  // 2. Format ig_caption in a markdown code block (` ```ig_caption``` `)
  const igCaption = article.ig_caption || article.igCaption || article.summary || article.title || '';
  const formattedCodeBlock = `\`\`\`\n${igCaption}\n\`\`\``;

  let messageResult;
  if (options.postMessageMock) {
    messageResult = await options.postMessageMock({ channel: targetChannel, text: formattedCodeBlock });
  } else {
    messageResult = await client.chat.postMessage({
      channel: targetChannel,
      text: formattedCodeBlock
    });
  }

  return {
    success: uploadErrors.length === 0,
    channel: targetChannel,
    uploadedFiles,
    uploadErrors,
    messageTs: messageResult ? messageResult.ts : null,
    formattedMessage: formattedCodeBlock
  };
}

module.exports = {
  slackDispatch
};
