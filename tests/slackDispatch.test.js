process.env.NODE_ENV = 'test';

const { slackDispatch } = require('../src/workers/slackDispatch');

describe('Slack Webhook Dispatch Worker', () => {
  const mockSecrets = {
    slack: {
      botToken: 'xoxb-mock-bot-token',
      channel: '#ig-staging'
    }
  };

  const sampleArticle = {
    id: 'slack-art-1',
    title: 'Slack Carousel Test',
    ig_caption: 'Check out our new Instagram carousel graphics! #961media',
    carouselFiles: ['carousel_1.png', 'carousel_2.png']
  };

  it('should upload carousel files via files.uploadV2 and send formatted ig_caption in a code block via chat.postMessage', async () => {
    const mockUploadV2 = jest.fn().mockImplementation(async ({ channel_id, fileInput }) => ({
      ok: true,
      file: { id: `F_${fileInput}`, name: fileInput }
    }));

    const mockPostMessage = jest.fn().mockImplementation(async ({ channel, text }) => ({
      ok: true,
      ts: '1234567890.123456',
      channel,
      message: { text }
    }));

    const result = await slackDispatch(sampleArticle, mockSecrets, {
      uploadV2Mock: mockUploadV2,
      postMessageMock: mockPostMessage
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('#ig-staging');
    expect(result.uploadedFiles.length).toBe(2);

    expect(mockUploadV2).toHaveBeenCalledTimes(2);
    expect(mockUploadV2).toHaveBeenCalledWith({
      channel_id: '#ig-staging',
      fileInput: 'carousel_1.png'
    });
    expect(mockUploadV2).toHaveBeenCalledWith({
      channel_id: '#ig-staging',
      fileInput: 'carousel_2.png'
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({
      channel: '#ig-staging',
      text: '```\nCheck out our new Instagram carousel graphics! #961media\n```'
    });

    expect(result.formattedMessage).toBe('```\nCheck out our new Instagram carousel graphics! #961media\n```');
    expect(result.messageTs).toBe('1234567890.123456');
  });

  it('should throw error if bot token is missing', async () => {
    const emptySecrets = { slack: { botToken: '', channel: '#ig-staging' } };
    await expect(slackDispatch(sampleArticle, emptySecrets))
      .rejects.toThrow('Slack Dispatch Error: Missing Slack Bot Token.');
  });
});
