import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:9090'

  return {
    plugins: [react()],
    assetsInclude: ['*.woff', '*.woff2', '*.ttf', '*.eot'],
    // 代理配置：将 /api 请求转发到 FastAPI 后端
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          // 不重写路径，保持 /api 前缀
        },
        '/public': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      // 确保 KaTeX 的字体文件被正确处理
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 1500,
      reportCompressedSize: false,
      // 禁止在 HTML 中为 CSS 生成 <link rel="modulepreload"> 标签
      // CSS 会在 JS chunk 执行时自动导入，无需单独预加载
      modulePreload: {
        polyfill: true,
        resolveDependencies: (_filename, dependencies, { hostType }) => {
          if (hostType === 'html') {
            return dependencies.filter((dep) => !dep.endsWith('.css'))
          }
          return dependencies
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            markdown: ['marked', 'dompurify', 'highlight.js'],
            katex: ['katex'],
            mermaid: ['mermaid'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  }
})

