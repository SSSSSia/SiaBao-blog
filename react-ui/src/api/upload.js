/**
 * 文件上传 API
 *
 * 支持按文章 UUID 分目录存储图片
 */

import { upload } from '../utils/request'

const API_BASE = '/api'

/**
 * 上传图片（支持文章 UUID 分目录）
 * @param {File} file - 图片文件
 * @param {string} articleId - 文章 ID（可选，用于分目录存储）
 * @returns {Promise<{filename: string, path: string, url: string}>} 上传结果
 */
export async function uploadImage(file, articleId = null) {
  const formData = new FormData()
  formData.append('file', file)

  // 如果有文章 ID，添加到表单数据
  if (articleId) {
    formData.append('article_id', articleId)
  }

  const response = await upload(`${API_BASE}/upload/image`, formData)

  return response
}

/**
 * 批量上传图片
 * @param {File[]} files - 图片文件数组
 * @param {string} articleId - 文章 ID（可选）
 * @returns {Promise<Array>} 上传结果数组
 */
export async function uploadImages(files, articleId = null) {
  const uploadPromises = Array.from(files).map(file => uploadImage(file, articleId))
  return Promise.all(uploadPromises)
}

/**
 * 删除图片
 * @param {string} filename - 文件名
 * @param {string} articleId - 文章 ID（可选）
 * @returns {Promise} 删除结果
 */
export async function deleteImage(filename, articleId = null) {
  const params = articleId ? `?article_id=${articleId}` : ''
  const url = `${API_BASE}/upload/image/${filename}${params}`

  return fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(async res => {
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.message || '删除失败')
    }
    return res.json()
  }).then(data => {
    if (data.code === '200') {
      return data.data
    }
    throw new Error(data.message || '删除失败')
  })
}

export default {
  uploadImage,
  uploadImages,
  deleteImage,
}
