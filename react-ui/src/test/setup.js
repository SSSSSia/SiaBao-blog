/**
 * Vitest 测试环境配置
 * 用于设置测试运行时的全局配置和工具
 */

import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// 扩展全局的 expect 匹配器
expect.extend(matchers)

// 每个测试后自动清理 DOM，防止测试间相互干扰
afterEach(() => {
  cleanup()
})
