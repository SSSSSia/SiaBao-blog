/**
 * 图片路径处理工具函数
 */

/**
 * 生成临时文章 ID
 * 用于新文章创建前的图片上传
 * @returns {string} 临时文章 ID（格式：temp_<timestamp>_<random>）
 */
export function generateTempArticleId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `temp_${timestamp}_${random}`
}

/**
 * 判断是否为临时文章 ID
 * @param {string} articleId - 文章 ID
 * @returns {boolean}
 */
export function isTempArticleId(articleId) {
  return articleId && articleId.startsWith('temp_')
}

/**
 * 获取完整的图片URL
 * @param {string} path - 图片路径（可能是相对路径或绝对路径）
 * @returns {string} 完整的图片URL
 */
export function getImageUrl(path) {
  if (!path) {
    return ''
  }

  // 如果是http/https开头的完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // 如果是 /src/ 开头的路径，这是本地开发时的资源路径
  if (path.startsWith('/src/')) {
    return path
  }

  // 如果是 /public/ 开头的路径，这是上传的图片
  if (path.startsWith('/public/')) {
    return path
  }

  // 如果是相对路径，且不以 / 开头
  if (!path.startsWith('/')) {
    // 可能是旧的相对路径格式，尝试转换为绝对路径
    return `/public/uploads/${path}`
  }

  // 其他情况直接返回
  return path
}

/**
 * 判断是否为上传的图片
 * @param {string} path - 图片路径
 * @returns {boolean}
 */
export function isUploadedImage(path) {
  if (!path) return false
  return path.startsWith('/public/uploads/')
}

/**
 * 获取图片文件名
 * @param {string} path - 图片路径
 * @returns {string} 文件名
 */
export function getImageFilename(path) {
  if (!path) return ''
  const parts = path.split('/')
  return parts[parts.length - 1]
}

/**
 * 验证图片URL是否有效
 * @param {string} url - 图片URL
 * @returns {Promise<boolean>}
 */
export async function validateImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}
