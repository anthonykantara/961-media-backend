const { WebClient } = require('@slack/web-api');
const { getSocialSecrets } = require('../services/secrets');

/**
 * Slack Webhook Dispatch Worker (#ig-staging):
 * Uploads all carousel_N.png files via files.uploadV2 and sends ig_caption
 * in a formatted markdown code block (` ```ig_caption``` `) using chat.postMessage.
 * 
 * @param {object} article Article object.
 * @param {object} [providedSecrets] Optional secrets object.
 * @param {object} [options] Optional overrides and mocks for testing.
 * @returns {Promise<object>} Status report with upload and message details.
 */
async function slackDispatch(article, providedSecrets = null, options = {}) {
  const secrets = providedSecrets || await getSocialSecrets(options);
  const { botToken, channel } = secrets.slack;
  const targetChannel = options.channel || channel || '#ig-staging';

  if (!botToken && !options.slackClient) {
    throw new Error('Slack Dispatch Error: Missing Slack Bot Token.');
  }

  const client = options.slackClient || new WebClient(botToken);

  // Extract carousel files
  const carouselFiles = options.carouselFiles || article.carouselFiles || article.carousel_files || article.carouselImages || [];

  const uploadedFiles = [];

  // 1. Upload all carousel_N.png files via files.uploadV2
  for (const fileInput of carouselFiles) {
    try {
      let uploadResult;
      if (options.uploadV2Mock) {
        uploadResult = await options.uploadV2Mock({ channel_id: targetChannel, fileInput });
      } else if (typeof fileInput === 'string') {
        uploadResult = await client.files.uploadV2({
          channel_id: targetChannel,
          file: fileInput,
          filename: fileInput.split('/').pop() || 'carousel_N.png'
        });
      } else if (Buffer.isBuffer(fileInput) || typeof fileInput === 'object') {
        uploadResult = await client.files.uploadV2({
          channel_id: targetChannel,
          file: fileInput.buffer || fileInput,
          filename: fileInput.filename || 'carousel_N.png'
        });
      }

      if (uploadResult) {
        uploadedFiles.push(uploadResult);
      }
    } catch (err) {
      console.error(`Failed to upload carousel file ${fileInput}:`, err.message);
    }
  }

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
    success: true,
    channel: targetChannel,
    uploadedFiles,
    messageTs: messageResult ? messageResult.ts : null,
    formattedMessage: formattedCodeBlock
  };
}

module.exports = {
  slackDispatch
};
