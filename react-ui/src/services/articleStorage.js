/**
 * 文章本地存储服务
 * 使用 localStorage 管理文章数据
 */

import { mockArticles } from '../constants/mockData';

const STORAGE_KEY = 'blog_articles';
const DRAFT_KEY = 'blog_draft_articles';

// 初始化存储
const initializeStorage = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // 首次使用，保存 mock 数据
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockArticles));
  }
};

// 获取所有文章（包括草稿）
export const getAllArticles = () => {
  initializeStorage();

  const published = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');

  // 合并发布和草稿，添加状态标记
  return {
    published: published.map(art => ({ ...art, status: 'published' })),
    drafts: drafts.map(art => ({ ...art, status: 'draft' })),
    all: [...published.map(art => ({ ...art, status: 'published' })),
           ...drafts.map(art => ({ ...art, status: 'draft' }))]
  };
};

// 获取文章列表（带筛选和搜索）
export const getArticleList = ({ status, category, keyword } = {}) => {
  const { all } = getAllArticles();

  let filtered = all;

  // 状态筛选
  if (status && status !== 'all') {
    filtered = filtered.filter(art => art.status === status);
  }

  // 分类筛选
  if (category) {
    filtered = filtered.filter(art =>
      art.category?.name === category || art.category === category
    );
  }

  // 关键词搜索
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    filtered = filtered.filter(art =>
      art.title?.toLowerCase().includes(lowerKeyword) ||
      art.excerpt?.toLowerCase().includes(lowerKeyword)
    );
  }

  // 按更新时间倒序
  filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return filtered;
};

// 根据 ID 获取文章
export const getArticleById = (id) => {
  const { published, drafts } = getAllArticles();

  const article =
    published.find(art => art.id === Number(id)) ||
    drafts.find(art => art.id === Number(id));

  return article || null;
};

// 创建文章
export const createArticle = (data) => {
  const { published, drafts } = getAllArticles();

  const newArticle = {
    id: Date.now(),
    title: data.title || '未命名文章',
    slug: data.slug || `article-${Date.now()}`,
    excerpt: data.excerpt || data.content?.substring(0, 100) || '',
    content: data.content || '',
    author: {
      name: '博主名',
      avatar: '/avatar.jpg',
      bio: '全栈开发者',
    },
    category: data.category ?
      (typeof data.category === 'string' ?
        { id: Date.now(), name: data.category, slug: data.category.toLowerCase() } :
        data.category) :
      { id: 1, name: '未分类', slug: 'uncategorized' },
    tags: data.tags ?
      (typeof data.tags === 'string' ?
        data.tags.split(',').map((tag, i) => ({
          id: Date.now() + i,
          name: tag.trim(),
          slug: tag.trim().toLowerCase()
        })) :
        data.tags) :
      [],
    stats: {
      views: 0,
      likes: 0,
      comments: 0,
    },
    publishedAt: data.status === 'published' ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    isPinned: false,
    coverImage: data.coverImage || null,
    readingTime: data.content ? Math.ceil(data.content.length / 400) : 1,
    status: data.status || 'draft',
  };

  if (newArticle.status === 'draft') {
    drafts.unshift(newArticle);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } else {
    published.unshift(newArticle);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
  }

  return newArticle;
};

// 更新文章
export const updateArticle = (id, data) => {
  const { published, drafts } = getAllArticles();

  const pubIndex = published.findIndex(art => art.id === Number(id));
  const draftIndex = drafts.findIndex(art => art.id === Number(id));

  let targetArray;
  let targetIndex;
  let current;

  if (pubIndex >= 0) {
    targetArray = published;
    targetIndex = pubIndex;
    current = published[pubIndex];
  } else if (draftIndex >= 0) {
    targetArray = drafts;
    targetIndex = draftIndex;
    current = drafts[draftIndex];
  } else {
    throw new Error('文章不存在');
  }

  const updated = {
    ...current,
    title: data.title !== undefined ? data.title : current.title,
    slug: data.slug !== undefined ? data.slug : current.slug,
    excerpt: data.excerpt !== undefined ? data.excerpt : current.excerpt,
    content: data.content !== undefined ? data.content : current.content,
    category: data.category !== undefined ?
      (typeof data.category === 'string' ?
        { id: current.category?.id || Date.now(), name: data.category, slug: data.category.toLowerCase() } :
        data.category) :
      current.category,
    tags: data.tags !== undefined ?
      (typeof data.tags === 'string' ?
        data.tags.split(',').map((tag, i) => ({
          id: Date.now() + i,
          name: tag.trim(),
          slug: tag.trim().toLowerCase()
        })) :
        data.tags) :
      current.tags,
    coverImage: data.coverImage !== undefined ? data.coverImage : current.coverImage,
    updatedAt: new Date().toISOString(),
    readingTime: data.content !== undefined ? Math.ceil(data.content.length / 400) : current.readingTime,
    status: data.status !== undefined ? data.status : current.status,
  };

  // 如果状态从草稿变为发布，设置发布时间
  if (data.status === 'published' && current.status !== 'published') {
    updated.publishedAt = new Date().toISOString();
  }

  // 处理状态变更时的数组移动
  const newStatus = data.status !== undefined ? data.status : current.status;

  if (current.status === 'draft' && newStatus === 'published') {
    // 从草稿移到发布
    drafts.splice(draftIndex, 1);
    published.unshift(updated);
  } else if (current.status === 'published' && newStatus === 'draft') {
    // 从发布移到草稿
    published.splice(pubIndex, 1);
    drafts.unshift(updated);
  } else {
    // 状态不变，仅在原位置更新
    targetArray[targetIndex] = updated;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));

  return updated;
};

// 删除文章
export const deleteArticle = (id) => {
  const { published, drafts } = getAllArticles();

  const pubIndex = published.findIndex(art => art.id === Number(id));
  const draftIndex = drafts.findIndex(art => art.id === Number(id));

  if (pubIndex >= 0) {
    published.splice(pubIndex, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
  } else if (draftIndex >= 0) {
    drafts.splice(draftIndex, 1);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } else {
    throw new Error('文章不存在');
  }

  return true;
};

// 获取分类列表
export const getCategories = () => {
  const { published } = getAllArticles();
  const categoryMap = new Map();

  published.forEach(art => {
    const cat = art.category;
    const name = (cat?.name || '').trim();
    if (name) {
      if (categoryMap.has(name)) {
        categoryMap.get(name).count++;
      } else {
        categoryMap.set(name, {
          id: cat.id,
          name,
          // 统一用名称作为筛选参数，避免同名不同 slug 分裂成多条
          slug: name,
          count: 1
        });
      }
    }
  });

  return Array.from(categoryMap.values());
};

export default {
  getAllArticles,
  getArticleList,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getCategories,
};
