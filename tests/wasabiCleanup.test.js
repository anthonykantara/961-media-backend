process.env.NODE_ENV = 'test';

const { wasabiCleanup } = require('../src/workers/wasabiCleanup');

describe('Wasabi Storage Cleanup Worker', () => {
  const mockSecrets = {
    wasabi: {
      accessKeyId: 'mock_access_key',
      secretAccessKey: 'mock_secret_key',
      bucket: '961-media-drafts',
      region: 'us-east-1',
      endpoint: 'https://s3.wasabisys.com'
    }
  };

  const sampleArticle = {
    id: 'wasabi-art-1',
    draftAssets: ['drafts/wasabi-art-1/temp1.png', 'drafts/wasabi-art-1/temp2.jpg'],
    tempImages: ['https://s3.wasabisys.com/961-media-drafts/temp/wasabi-art-1/social_preview.png']
  };

  it('should purge unapproved temporary images and draft assets', async () => {
    const mockS3Client = {
      send: jest.fn().mockImplementation(async (command) => {
        if (command.constructor.name === 'ListObjectsV2Command') {
          return {
            Contents: [
              { Key: 'drafts/wasabi-art-1/extra_asset.png' }
            ]
          };
        }
        if (command.constructor.name === 'DeleteObjectsCommand') {
          return {
            Deleted: [
              { Key: 'drafts/wasabi-art-1/temp1.png' },
              { Key: 'drafts/wasabi-art-1/temp2.jpg' },
              { Key: 'temp/wasabi-art-1/social_preview.png' },
              { Key: 'drafts/wasabi-art-1/extra_asset.png' }
            ]
          };
        }
        return {};
      })
    };

    const result = await wasabiCleanup(sampleArticle, mockSecrets, { s3Client: mockS3Client });

    expect(result.success).toBe(true);
    expect(result.bucket).toBe('961-media-drafts');
    expect(result.deletedKeys).toContain('drafts/wasabi-art-1/temp1.png');
    expect(result.deletedKeys).toContain('drafts/wasabi-art-1/temp2.jpg');
    expect(result.deletedKeys).toContain('temp/wasabi-art-1/social_preview.png');
    expect(result.deletedKeys).toContain('drafts/wasabi-art-1/extra_asset.png');
  });

  it('should handle empty asset lists gracefully without error', async () => {
    const emptyArticle = { id: 'empty-art' };
    const mockS3Client = {
      send: jest.fn().mockResolvedValue({ Contents: [] })
    };

    const result = await wasabiCleanup(emptyArticle, mockSecrets, { s3Client: mockS3Client });

    expect(result.success).toBe(true);
    expect(result.deletedKeys).toEqual([]);
  });
});
