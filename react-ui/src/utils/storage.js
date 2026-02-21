/**
 * 本地存储工具
 * 封装 localStorage 和 sessionStorage，提供类型安全的 API
 */

const STORAGE_KEY_PREFIX = 'my-blog_';

/**
 * 获取完整的存储 key
 */
function getStorageKey(key) {
  return `${STORAGE_KEY_PREFIX}${key}`;
}

/**
 * LocalStorage 操作
 */
export const localStorage = {
  /**
   * 保存数据
   * @param {string} key - 键名
   * @param {*} value - 值（自动序列化）
   */
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(getStorageKey(key), serialized);
    } catch (error) {
      console.error('LocalStorage 保存失败:', error);
    }
  },

  /**
   * 获取数据
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {*} 解析后的值
   */
  get(key, defaultValue = null) {
    try {
      const item = window.localStorage.getItem(getStorageKey(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('LocalStorage 读取失败:', error);
      return defaultValue;
    }
  },

  /**
   * 删除数据
   * @param {string} key - 键名
   */
  remove(key) {
    try {
      window.localStorage.removeItem(getStorageKey(key));
    } catch (error) {
      console.error('LocalStorage 删除失败:', error);
    }
  },

  /**
   * 清空所有数据
   */
  clear() {
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach((key) => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('LocalStorage 清空失败:', error);
    }
  },

  /**
   * 检查 key 是否存在
   * @param {string} key - 键名
   * @returns {boolean}
   */
  has(key) {
    return window.localStorage.getItem(getStorageKey(key)) !== null;
  },
};

/**
 * SessionStorage 操作
 */
export const sessionStorage = {
  /**
   * 保存数据
   * @param {string} key - 键名
   * @param {*} value - 值（自动序列化）
   */
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      window.sessionStorage.setItem(getStorageKey(key), serialized);
    } catch (error) {
      console.error('SessionStorage 保存失败:', error);
    }
  },

  /**
   * 获取数据
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {*} 解析后的值
   */
  get(key, defaultValue = null) {
    try {
      const item = window.sessionStorage.getItem(getStorageKey(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('SessionStorage 读取失败:', error);
      return defaultValue;
    }
  },

  /**
   * 删除数据
   * @param {string} key - 键名
   */
  remove(key) {
    try {
      window.sessionStorage.removeItem(getStorageKey(key));
    } catch (error) {
      console.error('SessionStorage 删除失败:', error);
    }
  },

  /**
   * 清空所有数据
   */
  clear() {
    try {
      const keys = Object.keys(window.sessionStorage);
      keys.forEach((key) => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          window.sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('SessionStorage 清空失败:', error);
    }
  },

  /**
   * 检查 key 是否存在
   * @param {string} key - 键名
   * @returns {boolean}
   */
  has(key) {
    return window.sessionStorage.getItem(getStorageKey(key)) !== null;
  },
};

export default { localStorage, sessionStorage };
