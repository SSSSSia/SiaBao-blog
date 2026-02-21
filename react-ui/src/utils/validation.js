/**
 * 表单验证工具
 * 提供常用的表单验证规则
 */

/**
 * 验证规则集合
 */
export const validators = {
  /**
   * 验证必填
   */
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return '此项为必填项';
    }
    return null;
  },

  /**
   * 验证邮箱
   */
  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return '请输入有效的邮箱地址';
    }
    return null;
  },

  /**
   * 验证手机号（中国大陆）
   */
  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return '请输入有效的手机号';
    }
    return null;
  },

  /**
   * 验证 URL
   */
  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return '请输入有效的 URL';
    }
  },

  /**
   * 验证最小长度
   */
  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `最少需要 ${min} 个字符`;
    }
    return null;
  },

  /**
   * 验证最大长度
   */
  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `最多允许 ${max} 个字符`;
    }
    return null;
  },

  /**
   * 验证长度范围
   */
  lengthRange: (min, max) => (value) => {
    if (!value) return null;
    if (value.length < min || value.length > max) {
      return `长度需要在 ${min} 到 ${max} 之间`;
    }
    return null;
  },

  /**
   * 验证用户名（字母、数字、下划线，3-20字符）
   */
  username: (value) => {
    if (!value) return null;
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(value)) {
      return '用户名只能包含字母、数字、下划线，长度 3-20 字符';
    }
    return null;
  },

  /**
   * 验证密码（至少 8 个字符，包含字母和数字）
   */
  password: (value) => {
    if (!value) return null;
    if (value.length < 8) {
      return '密码至少需要 8 个字符';
    }
    const hasLetter = /[a-zA-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    if (!hasLetter || !hasNumber) {
      return '密码需要包含字母和数字';
    }
    return null;
  },

  /**
   * 验证确认密码
   */
  confirmPassword: (passwordField) => (value, formData) => {
    if (!value) return null;
    if (value !== formData[passwordField]) {
      return '两次输入的密码不一致';
    }
    return null;
  },
};

/**
 * 验证表单字段
 * @param {*} value - 字段值
 * @param {Array} rules - 验证规则数组
 * @param {Object} formData - 完整表单数据
 * @returns {string|null} 错误信息，null 表示验证通过
 */
export function validateField(value, rules = [], formData = {}) {
  for (const rule of rules) {
    let error;

    if (typeof rule === 'function') {
      error = rule(value, formData);
    } else if (typeof rule === 'object' && rule.validator) {
      error = rule.validator(value, formData);
    }

    if (error) {
      return typeof rule === 'object' && rule.message
        ? rule.message
        : error;
    }
  }

  return null;
}

/**
 * 验证整个表单
 * @param {Object} formData - 表单数据
 * @param {Object} schema - 验证规则对象 { fieldName: rules[] }
 * @returns {Object} { valid: boolean, errors: {}, firstError: string }
 */
export function validateForm(formData, schema) {
  const errors = {};
  let firstError = null;

  for (const [field, rules] of Object.entries(schema)) {
    const error = validateField(formData[field], rules, formData);
    if (error) {
      errors[field] = error;
      if (!firstError) {
        firstError = error;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    firstError,
  };
}

export default {
  validators,
  validateField,
  validateForm,
};
