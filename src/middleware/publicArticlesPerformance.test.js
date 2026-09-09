const { buildArticleQuery } = require('./publicArticlesPerformance');

describe('public article query builder', () => {
  test('defaults feed queries to published articles', () => {
    const { sql, params } = buildArticleQuery({}, 'published');
    expect(sql).toContain('LOWER(a.status) = $1');
    expect(params).toEqual(['published']);
  });

  test('pushes filtering and pagination into PostgreSQL parameters', () => {
    const { sql, params } = buildArticleQuery({
      status: 'published',
      category: 'News',
      language: 'en',
      locationId: 'lb',
      regionId: 'levant',
      search: 'beirut',
      limit: '20',
      page: '3'
    });

    expect(sql).toContain('LOWER(a.status) = $1');
    expect(sql).toContain('LOWER(a.category) = $2');
    expect(sql).toContain('LOWER(a.language) = $3');
    expect(sql).toContain('LOWER(a.location_id) = $4');
    expect(sql).toContain('LOWER(l.region_id) = $5');
    expect(sql).toContain('LIMIT $7');
    expect(sql).toContain('OFFSET $8');
    expect(params).toEqual(['published', 'news', 'en', 'lb', 'levant', 'beirut', 20, 40]);
  });

  test('supports permalink and slug lookup using a single parameter per filter', () => {
    const permalinkQuery = buildArticleQuery({ permalink: 'My-Article' });
    expect(permalinkQuery.params).toEqual(['my-article']);
    expect(permalinkQuery.sql).toContain('LOWER(a.permalink) = $1');

    const slugQuery = buildArticleQuery({ slug: 'My-Slug' });
    expect(slugQuery.params).toEqual(['my-slug']);
    expect(slugQuery.sql).toContain('LOWER(a.slug) = $1');
  });
});
