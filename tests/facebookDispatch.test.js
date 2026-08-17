process.env.NODE_ENV = 'test';

const { facebookDispatch } = require('../src/workers/facebookDispatch');

describe('Facebook Page Integration Worker', () => {
  const mockSecrets = {
    meta: {
      pageId: '123456789',
      accessToken: 'EAAC_mock_facebook_token'
    }
  };

  const sampleArticle = {
    id: 'fb-art-1',
    title: 'Facebook Integration Test',
    summary: 'A short summary for Facebook.',
    social_summary: 'Breaking news summary for Facebook!'
  };

  it('should send POST request to Meta Graph API /{page-id}/feed with social_summary and website link', async () => {
    let requestedUrl = '';
    let requestedOptions = {};

    const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
      requestedUrl = url;
      requestedOptions = opts;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789_987654321' })
      };
    });

    const result = await facebookDispatch(sampleArticle, mockSecrets, { fetch: mockFetch });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('123456789_987654321');
    expect(requestedUrl).toBe('https://graph.facebook.com/v19.0/123456789/feed');
    expect(requestedOptions.method).toBe('POST');

    const body = JSON.parse(requestedOptions.body);
    expect(body.message).toBe('Breaking news summary for Facebook!');
    expect(body.link).toContain('/articles/fb-art-1');
    expect(body.access_token).toBe('EAAC_mock_facebook_token');
  });

  it('should throw an error if Meta Graph API returns non-200 or error body', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token.' } })
    });

    await expect(facebookDispatch(sampleArticle, mockSecrets, { fetch: mockFetch }))
      .rejects.toThrow('Facebook API Error (400): Invalid OAuth access token.');
  });

  it('should throw error if pageId or accessToken is missing', async () => {
    const emptySecrets = { meta: { pageId: '', accessToken: '' } };
    await expect(facebookDispatch(sampleArticle, emptySecrets))
      .rejects.toThrow('Facebook Dispatch Error: Missing Meta Graph API pageId or accessToken.');
  });
});
