/**
 * Statistics service based on backend article API data.
 */

import { articleApi } from '../api/articles';

const EMPTY_STATS = {
  totalArticles: 0,
  publishedArticles: 0,
  draftCount: 0,
  categoryCount: 0,
  tagCount: 0,
  totalViews: 0,
  totalLikes: 0,
  totalComments: 0,
  latestArticles: [],
  categories: [],
  tags: [],
};

export const getStatistics = async () => {
  const response = await articleApi.getList({ page: 1, pageSize: 100 });
  const allArticles = response.articles || [];

  const published = allArticles.filter((article) => article.status === 'published');
  const drafts = allArticles.filter((article) => article.status === 'draft');

  const categoryMap = new Map();
  published.forEach((article) => {
    const categoryName = article.category || 'Uncategorized';
    categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
  });

  const tagMap = new Map();
  published.forEach((article) => {
    (article.tags || []).forEach((tag) => {
      const tagName = typeof tag === 'string' ? tag : tag?.name;
      if (!tagName) return;
      tagMap.set(tagName, (tagMap.get(tagName) || 0) + 1);
    });
  });

  const latestArticles = [...published]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.updatedAt || 0).getTime() -
        new Date(a.updated_at || a.updatedAt || 0).getTime(),
    )
    .slice(0, 5);

  // 计算总浏览量和总点赞数
  const totalViews = allArticles.reduce((sum, article) => {
    const views = article?.stats?.views || 0;
    return sum + views;
  }, 0);

  const totalLikes = allArticles.reduce((sum, article) => {
    const likes = article?.stats?.likes || 0;
    return sum + likes;
  }, 0);

  return {
    ...EMPTY_STATS,
    totalArticles: allArticles.length,
    publishedArticles: published.length,
    draftCount: drafts.length,
    categoryCount: categoryMap.size,
    tagCount: tagMap.size,
    totalViews,
    totalLikes,
    categories: Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    })),
    tags: Array.from(tagMap.entries()).map(([name, count]) => ({
      name,
      count,
    })),
    latestArticles,
  };
};

export default getStatistics;
