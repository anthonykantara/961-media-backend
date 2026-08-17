process.env.NODE_ENV = 'test';

const { getSecretValue, getSocialSecrets, clearSecretsCache } = require('../src/services/secrets');

describe('Secrets Management Service', () => {
  beforeEach(() => {
    clearSecretsCache();
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.FACEBOOK_PAGE_ID;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_AUTHOR_URN;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL;
    delete process.env.WASABI_ACCESS_KEY_ID;
    delete process.env.WASABI_SECRET_ACCESS_KEY;
  });

  it('should retrieve JSON secret from AWS Secrets Manager using mock client', async () => {
    const mockClient = {
      send: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({
          META_ACCESS_TOKEN: 'aws_meta_token',
          FACEBOOK_PAGE_ID: 'aws_page_123',
          LINKEDIN_ACCESS_TOKEN: 'aws_linkedin_token',
          LINKEDIN_AUTHOR_URN: 'urn:li:organization:999',
          SLACK_BOT_TOKEN: 'xoxb-aws-slack-token',
          SLACK_CHANNEL: '#ig-staging',
          WASABI_ACCESS_KEY_ID: 'aws_wasabi_key',
          WASABI_SECRET_ACCESS_KEY: 'aws_wasabi_secret'
        })
      })
    };

    const secrets = await getSocialSecrets({ client: mockClient, secretName: 'test/secret' });

    expect(mockClient.send).toHaveBeenCalled();
    expect(secrets.meta.accessToken).toBe('aws_meta_token');
    expect(secrets.meta.pageId).toBe('aws_page_123');
    expect(secrets.linkedin.accessToken).toBe('aws_linkedin_token');
    expect(secrets.linkedin.authorUrn).toBe('urn:li:organization:999');
    expect(secrets.slack.botToken).toBe('xoxb-aws-slack-token');
    expect(secrets.slack.channel).toBe('#ig-staging');
    expect(secrets.wasabi.accessKeyId).toBe('aws_wasabi_key');
    expect(secrets.wasabi.secretAccessKey).toBe('aws_wasabi_secret');
  });

  it('should fall back to process.env if AWS Secrets Manager fails or returns null', async () => {
    process.env.META_ACCESS_TOKEN = 'env_meta_token';
    process.env.FACEBOOK_PAGE_ID = 'env_page_456';
    process.env.LINKEDIN_ACCESS_TOKEN = 'env_linkedin_token';
    process.env.LINKEDIN_AUTHOR_URN = 'urn:li:organization:888';
    process.env.SLACK_BOT_TOKEN = 'xoxb-env-slack-token';
    process.env.WASABI_ACCESS_KEY_ID = 'env_wasabi_key';
    process.env.WASABI_SECRET_ACCESS_KEY = 'env_wasabi_secret';

    const mockClient = {
      send: jest.fn().mockRejectedValue(new Error('AWS SM Error'))
    };

    const secrets = await getSocialSecrets({ client: mockClient, secretName: 'fail/secret' });

    expect(secrets.meta.accessToken).toBe('env_meta_token');
    expect(secrets.meta.pageId).toBe('env_page_456');
    expect(secrets.linkedin.accessToken).toBe('env_linkedin_token');
    expect(secrets.linkedin.authorUrn).toBe('urn:li:organization:888');
    expect(secrets.slack.botToken).toBe('xoxb-env-slack-token');
    expect(secrets.slack.channel).toBe('#ig-staging'); // default
    expect(secrets.wasabi.accessKeyId).toBe('env_wasabi_key');
  });

  it('should cache secret value and return from cache on subsequent calls', async () => {
    const mockClient = {
      send: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ META_ACCESS_TOKEN: 'cached_token' })
      })
    };

    const firstVal = await getSecretValue('cached/secret', { client: mockClient });
    expect(firstVal.META_ACCESS_TOKEN).toBe('cached_token');
    expect(mockClient.send).toHaveBeenCalledTimes(1);

    const secondVal = await getSecretValue('cached/secret', { client: mockClient });
    expect(secondVal.META_ACCESS_TOKEN).toBe('cached_token');
    expect(mockClient.send).toHaveBeenCalledTimes(1); // not called again due to cache
  });
});
