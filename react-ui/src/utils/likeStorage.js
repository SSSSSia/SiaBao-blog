/**
 * 点赞存储工具
 * 使用 localStorage 持久化用户的点赞状态
 */

const LIKE_STORAGE_KEY = 'blog_liked_articles';

/**
 * 获取已点赞的文章ID列表
 * @returns {Set<string>} 已点赞的文章ID集合
 */
export function getLikedArticles() {
  try {
    const stored = localStorage.getItem(LIKE_STORAGE_KEY);
    if (!stored) return new Set();
    const ids = JSON.parse(stored);
    return new Set(ids);
  } catch (error) {
    console.error('读取点赞状态失败:', error);
    return new Set();
  }
}

/**
 * 保存已点赞的文章ID列表
 * @param {Set<string>} likedIds - 已点赞的文章ID集合
 */
function saveLikedArticles(likedIds) {
  try {
    const ids = Array.from(likedIds);
    localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('保存点赞状态失败:', error);
  }
}

/**
 * 检查文章是否已点赞
 * @param {string} articleId - 文章ID
 * @returns {boolean} 是否已点赞
 */
export function isArticleLiked(articleId) {
  const likedIds = getLikedArticles();
  return likedIds.has(String(articleId));
}

/**
 * 添加点赞
 * @param {string} articleId - 文章ID
 */
export function addLike(articleId) {
  const likedIds = getLikedArticles();
  likedIds.add(String(articleId));
  saveLikedArticles(likedIds);
}

/**
 * 取消点赞
 * @param {string} articleId - 文章ID
 */
export function removeLike(articleId) {
  const likedIds = getLikedArticles();
  likedIds.delete(String(articleId));
  saveLikedArticles(likedIds);
}

/**
 * 切换点赞状态
 * @param {string} articleId - 文章ID
 * @param {boolean} liked - 是否点赞
 */
export function setLikeStatus(articleId, liked) {
  if (liked) {
    addLike(articleId);
  } else {
    removeLike(articleId);
  }
}
