process.env.NODE_ENV = 'test';

const { cmsDispatch } = require('../src/workers/cmsDispatch');
const articleStore = require('../src/models/articleStore');

describe('CMS Database Dispatch Worker', () => {
  beforeEach(async () => {
    await articleStore.clearStore();
  });

  afterAll(async () => {
    await articleStore.clearStore();
  });

  it('should update post status to published and bind featured.jpg as thumbnail', async () => {
    const article = await articleStore.createArticle({
      title: 'CMS Dispatch Test Article',
      content: 'Testing internal DB writer.',
      status: 'draft'
    });

    const result = await cmsDispatch(article.id);

    expect(result.id).toBe(article.id);
    expect(result.status).toBe('published');
    expect(result.image).toBe('featured.jpg');
    expect(result.imageUrl).toBe('featured.jpg');

    // Verify persistence in store
    const updated = await articleStore.getArticleById(article.id);
    expect(updated.status).toBe('published');
    expect(updated.image).toBe('featured.jpg');
  });

  it('should bind custom thumbnail if provided in options', async () => {
    const article = await articleStore.createArticle({
      title: 'Custom Thumbnail Test',
      content: 'Testing custom image binding.',
      status: 'draft'
    });

    const result = await cmsDispatch(article.id, { thumbnail: 'https://example.com/custom.jpg' });

    expect(result.status).toBe('published');
    expect(result.image).toBe('https://example.com/custom.jpg');
    expect(result.imageUrl).toBe('https://example.com/custom.jpg');
  });

  it('should throw error if article ID does not exist', async () => {
    await expect(cmsDispatch('non-existent-id')).rejects.toThrow('Article with ID non-existent-id not found');
  });
});
