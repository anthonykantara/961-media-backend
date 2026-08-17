process.env.NODE_ENV = 'test';

const { linkedinDispatch } = require('../src/workers/linkedinDispatch');

describe('LinkedIn Integration Worker', () => {
  const mockSecrets = {
    linkedin: {
      accessToken: 'mock_linkedin_access_token',
      authorUrn: 'urn:li:organization:987654321'
    }
  };

  const sampleArticle = {
    id: 'li-art-1',
    title: 'LinkedIn Dispatch Test',
    summary: 'Short summary for LinkedIn.',
    social_summary: 'In-depth analysis for LinkedIn professional network!'
  };

  it('should post to LinkedIn UGC Post API /v2/ugcPosts with author, social_summary, and website link', async () => {
    let requestedUrl = '';
    let requestedOptions = {};

    const mockFetch = jest.fn().mockImplementation(async (url, opts) => {
      requestedUrl = url;
      requestedOptions = opts;
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 'urn:li:share:12345678' })
      };
    });

    const result = await linkedinDispatch(sampleArticle, mockSecrets, { fetch: mockFetch });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('urn:li:share:12345678');
    expect(requestedUrl).toBe('https://api.linkedin.com/v2/ugcPosts');
    expect(requestedOptions.method).toBe('POST');
    expect(requestedOptions.headers['Authorization']).toBe('Bearer mock_linkedin_access_token');
    expect(requestedOptions.headers['X-Restli-Protocol-Version']).toBe('2.0.0');

    const body = JSON.parse(requestedOptions.body);
    expect(body.author).toBe('urn:li:organization:987654321');
    expect(body.lifecycleState).toBe('PUBLISHED');

    const shareContent = body.specificContent['com.linkedin.ugc.ShareContent'];
    expect(shareContent.shareCommentary.text).toBe('In-depth analysis for LinkedIn professional network!');
    expect(shareContent.media[0].originalUrl).toContain('/articles/li-art-1');
  });

  it('should throw error if LinkedIn API returns error response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Expired access token' })
    });

    await expect(linkedinDispatch(sampleArticle, mockSecrets, { fetch: mockFetch }))
      .rejects.toThrow('LinkedIn API Error (401): Expired access token');
  });

  it('should throw error if credentials are missing', async () => {
    const emptySecrets = { linkedin: { accessToken: '', authorUrn: '' } };
    await expect(linkedinDispatch(sampleArticle, emptySecrets))
      .rejects.toThrow('LinkedIn Dispatch Error: Missing LinkedIn accessToken or authorUrn.');
  });
});
