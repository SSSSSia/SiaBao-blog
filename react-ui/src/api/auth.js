/**
 * 认证相关 API
 */

import { get, post } from '../utils/request';

// API 基础 URL
const API_BASE = '/api';

/**
 * 认证 API
 */
export const authApi = {
  /**
   * 用户登录
   * @param {Object} credentials - 登录信息 { username, password }
   * @returns {Promise}
   */
  login: (credentials) => {
    return post(`${API_BASE}/auth/login`, credentials);
  },

  /**
   * 用户登出
   * @returns {Promise}
   */
  logout: () => {
    return post(`${API_BASE}/auth/logout`);
  },

  /**
   * 用户注册
   * @param {Object} data - 注册信息
   * @returns {Promise}
   */
  register: (data) => {
    return post(`${API_BASE}/auth/register`, data);
  },

  /**
   * 获取当前用户信息
   * @returns {Promise}
   */
  getCurrentUser: () => {
    return get(`${API_BASE}/auth/me`);
  },

  /**
   * 刷新 Token
   * @returns {Promise}
   */
  refreshToken: () => {
    return post(`${API_BASE}/auth/refresh`);
  },
};

export default authApi;
