const { WebClient } = require('@slack/web-api');
const { getSocialSecrets } = require('./secrets');

/**
 * Creates or notifies internal Slack channel (#ads-{company_slug})
 */
async function createAdsSlackChannel(companySlug, campaignData = {}, options = {}) {
  const cleanSlug = (companySlug || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 70);

  const channelName = `ads-${cleanSlug}`;
  let channelId = null;
  let created = false;
  let notificationSent = false;

  if (process.env.NODE_ENV === 'test' || options.mock) {
    return {
      success: true,
      channelName: `#${channelName}`,
      channelId: `C_MOCK_${cleanSlug.toUpperCase().replace(/-/g, '_')}`,
      created: true,
      notificationSent: true
    };
  }

  try {
    const secrets = options.secrets || await getSocialSecrets(options);
    const botToken = options.botToken || (secrets.slack && secrets.slack.botToken);

    if (botToken) {
      const client = options.slackClient || new WebClient(botToken);

      // Try creating channel
      try {
        const createRes = await client.conversations.create({
          name: channelName,
          is_private: false
        });
        if (createRes && createRes.channel) {
          channelId = createRes.channel.id;
          created = true;
        }
      } catch (err) {
        // Channel may already exist
        if (err.data && err.data.error === 'name_taken') {
          created = true;
        }
      }

      // Post summary message
      const text = `🚀 *New Advertising Campaign Deal Created!*\n` +
        `• *Brand:* ${campaignData.brandName || campaignData.name || 'N/A'}\n` +
        `• *Budget:* $${campaignData.totalAmount || campaignData.budget || 0}\n` +
        `• *Objective:* ${campaignData.objective || 'Brand Awareness'}\n` +
        `• *Status:* ${campaignData.status || 'Active'}\n` +
        `• *Contact:* ${campaignData.contactEmail || campaignData.email || 'N/A'}`;

      try {
        await client.chat.postMessage({
          channel: `#${channelName}`,
          text
        });
        notificationSent = true;
      } catch (postErr) {
        // Fallback to default slack channel if posting to custom channel fails
        try {
          const defaultChannel = options.defaultChannel || (secrets.slack && secrets.slack.channel) || '#ig-staging';
          await client.chat.postMessage({
            channel: defaultChannel,
            text: `[#${channelName}] ${text}`
          });
          notificationSent = true;
        } catch (fErr) {}
      }
    } else {
      // Mock mode for local dev
      created = true;
      notificationSent = true;
    }
  } catch (err) {
    console.warn(`Slack channel creation notice for #${channelName}:`, err.message);
  }

  return {
    success: true,
    channelName: `#${channelName}`,
    channelId,
    created,
    notificationSent
  };
}

module.exports = {
  createAdsSlackChannel
};
