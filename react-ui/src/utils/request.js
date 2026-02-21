/**
 * HTTP 请求封装（带超时控制）
 * 强制规则：所有网络请求必须设置超时
 *
 * 统一响应格式处理：
 * 成功：{ code: "200", message: "...", data: {...} } -> 返回 data
 * 失败：{ code: "xxx", message: "...", data: {...} } -> 抛出错误
 */

const DEFAULT_TIMEOUT = 10000; // 10秒超时

/**
 * 统一的响应码常量
 */
export const ResponseCode = {
  SUCCESS: '200',
  FAIL: '400',
  UNAUTHORIZED: '401',
  FORBIDDEN: '403',
  NOT_FOUND: '404',
  ERROR: '500',
};

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(message, code, data, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

/**
 * 获取 JWT Token
 */
const getAuthToken = () => {
  try {
    const token = window.localStorage.getItem('my-blog_token');
    if (token) {
      const parsed = JSON.parse(token);
      return parsed;
    }
  } catch (error) {
    console.error('获取 token 失败:', error);
  }
  return null;
};

/**
 * 发送 HTTP 请求
 * @param {string} url - 请求地址
 * @param {Object} options - 请求配置
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise} 响应数据
 */
export async function request(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // 自动添加 Authorization header（如果有 token）
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    // 解析 JSON 响应
    const jsonData = await response.json().catch(() => null);

    // 处理 HTTP 错误状态码
    if (!response.ok) {
      // 如果是 401 错误，可能是 token 过期，清除本地存储并跳转到登录页
      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem('my-blog_token');
        window.localStorage.removeItem('my-blog_user');
        // 跳转到登录页（避免在登录页本身跳转造成死循环）
        if (!window.location.pathname.startsWith('/admin/login')) {
          window.location.href = '/admin/login';
        }
      }

      // 如果返回的是统一格式，提取 message 和 code
      if (jsonData && typeof jsonData === 'object') {
        const { code, message, data } = jsonData;
        throw new ApiError(
          message || `HTTP ${response.status}: ${response.statusText}`,
          code || String(response.status),
          data,
          response.status
        );
      }

      // 否则抛出普通错误
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.data = jsonData;
      throw error;
    }

    // 处理统一响应格式
    if (jsonData && typeof jsonData === 'object' && 'code' in jsonData) {
      const { code, message, data } = jsonData;

      // 判断业务状态码
      if (code === ResponseCode.SUCCESS) {
        // 成功，返回 data 字段
        return data;
      } else {
        // 失败，抛出错误
        throw new ApiError(message, code, data, response.status);
      }
    }

    // 如果不是统一格式，直接返回数据
    return jsonData;
  } catch (error) {
    clearTimeout(timeoutId);

    // 如果是 ApiError，直接抛出
    if (error instanceof ApiError) {
      throw error;
    }

    // 如果是超时错误
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }

    // 其他错误
    throw error;
  }
}

/**
 * GET 请求
 */
export function get(url, params = {}, options = {}) {
  const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
  const queryString = new URLSearchParams(filteredParams).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  return request(fullUrl, { ...options, method: 'GET' });
}

/**
 * POST 请求
 */
export function post(url, data = {}, options = {}) {
  return request(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PUT 请求
 */
export function put(url, data = {}, options = {}) {
  return request(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE 请求
 */
export function del(url, options = {}) {
  return request(url, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * 上传文件
 * @param {string} url - 请求地址
 * @param {FormData} formData - 包含文件的表单数据
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise} 响应数据
 */
export function upload(url, formData, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 自动添加 Authorization header
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    method: 'POST',
    signal: controller.signal,
    headers,
    body: formData,
    // 不设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
  })
    .then(async (response) => {
      clearTimeout(timeoutId);

      // 解析 JSON 响应
      const jsonData = await response.json().catch(() => null);

      // 处理 HTTP 错误状态码
      if (!response.ok) {
        // 如果是 401 错误，可能是 token 过期，清除本地存储并跳转到登录页
        if (response.status === 401 || response.status === 403) {
          window.localStorage.removeItem('my-blog_token');
          window.localStorage.removeItem('my-blog_user');
          // 跳转到登录页（避免在登录页本身跳转造成死循环）
          if (!window.location.pathname.startsWith('/admin/login')) {
            window.location.href = '/admin/login';
          }
        }
        // 如果返回的是统一格式，提取 message 和 code
        if (jsonData && typeof jsonData === 'object') {
          const { code, message, data } = jsonData;
          throw new ApiError(
            message || `HTTP ${response.status}: ${response.statusText}`,
            code || String(response.status),
            data,
            response.status
          );
        }

        // 否则抛出普通错误
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.data = jsonData;
        throw error;
      }

      // 处理统一响应格式
      if (jsonData && typeof jsonData === 'object' && 'code' in jsonData) {
        const { code, message, data } = jsonData;

        // 判断业务状态码
        if (code === ResponseCode.SUCCESS) {
          // 成功，返回 data 字段
          return data;
        } else {
          // 失败，抛出错误
          throw new ApiError(message, code, data, response.status);
        }
      }

      // 如果不是统一格式，直接返回数据
      return jsonData;
    })
    .catch((error) => {
      clearTimeout(timeoutId);

      // 如果是 ApiError，直接抛出
      if (error instanceof ApiError) {
        throw error;
      }

      // 如果是超时错误
      if (error.name === 'AbortError') {
        throw new Error('请求超时');
      }

      // 其他错误
      throw error;
    });
}

/**
 * 下载文件
 * @param {string} url - 请求地址
 * @param {string} filename - 下载的文件名
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise} Blob 数据
 */
export function download(url, filename, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 自动添加 Authorization header
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    method: 'GET',
    signal: controller.signal,
    headers,
  })
    .then(async (response) => {
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const blob = await response.blob();

      // 创建下载链接并触发下载
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return blob;
    })
    .catch((error) => {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('请求超时');
      }

      throw error;
    });
}

export default { request, get, post, put, del, upload, download };
