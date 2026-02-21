/**
 * Mock 数据
 * 用于开发和测试
 */

export const mockArticles = [
  {
    id: 999,
    title: '数学公式测试',
    slug: 'math-test',
    excerpt: '测试 KaTeX 数学公式渲染功能',
    content: `# 数学公式测试

## 行内公式
爱因斯坦质能方程：$E = mc^2$

二次方程求根公式：$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

勾股定理：$a^2 + b^2 = c^2$

## 块级公式
欧拉公式（被誉为最美数学公式）：

$$e^{i\\pi} + 1 = 0$$

微积分基本定理：

$$\\int_{a}^{b} f(x)dx = F(b) - F(a)$$

矩阵示例：

$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
$$

求和公式：

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

极限定义：

$$\\lim_{x \\to \\infty} \\frac{1}{x} = 0$$

泰勒展开：

$$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$$

## 代码中的美元符号
这段代码中的 \\$ 不会被渲染为公式：

\\\`javascript
const price = 100;
const total = \\$100 + \\$50;
console.log(total);
\\\`

## 测试失败情况
这个公式语法错误，应该显示原文：

$\\unclosed{bracket$

## 货币测试
这些不会被渲染为公式：
- 价格：\\$100
- 折扣：20\\% off
- 总计：\\$1,234.56
`,
    author: {
      name: '博主名',
      avatar: '/avatar.jpg',
      bio: '全栈开发者',
    },
    category: {
      id: 1,
      name: '前端开发',
      slug: 'frontend',
    },
    tags: [
      { id: 5, name: '测试', slug: 'test' },
      { id: 6, name: 'KaTeX', slug: 'katex' },
    ],
    stats: {
      views: 0,
      likes: 0,
      comments: 0,
    },
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPinned: true,
    coverImage: '/covers/math-test.jpg',
    readingTime: 5,
  },
  {
    id: 1,
    title: 'React 19 新特性深度解析',
    slug: 'react-19-new-features',
    excerpt: 'React 19 带来了许多激动人心的新特性，包括 useTransition、useActionState 等...',
    content: '# React 19 新特性\n\nReact 19 是一个重要的版本更新...',
    author: {
      name: '博主名',
      avatar: '/avatar.jpg',
      bio: '全栈开发者',
    },
    category: {
      id: 1,
      name: '前端开发',
      slug: 'frontend',
    },
    tags: [
      { id: 1, name: 'React', slug: 'react' },
      { id: 2, name: 'JavaScript', slug: 'javascript' },
    ],
    stats: {
      views: 1234,
      likes: 56,
      comments: 12,
    },
    publishedAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    isPinned: true,
    coverImage: '/covers/react-19.jpg',
    readingTime: 8,
  },
  {
    id: 2,
    title: 'Vite 7.3.1 构建工具实践',
    slug: 'vite-731-practice',
    excerpt: 'Vite 7.3.1 带来了更快的构建速度和更好的开发体验...',
    content: '# Vite 7.3.1\n\nVite 是下一代前端构建工具...',
    author: {
      name: '博主名',
      avatar: '/avatar.jpg',
      bio: '全栈开发者',
    },
    category: {
      id: 1,
      name: '前端开发',
      slug: 'frontend',
    },
    tags: [
      { id: 3, name: 'Vite', slug: 'vite' },
      { id: 4, name: '构建工具', slug: 'build-tools' },
    ],
    stats: {
      views: 892,
      likes: 34,
      comments: 8,
    },
    publishedAt: '2025-01-10T14:20:00Z',
    updatedAt: '2025-01-10T14:20:00Z',
    isPinned: false,
    coverImage: '/covers/vite.jpg',
    readingTime: 6,
  },
];

export const mockCategories = [
  { id: 1, name: '前端开发', slug: 'frontend', count: 25 },
  { id: 2, name: '后端开发', slug: 'backend', count: 15 },
  { id: 3, name: '数据库', slug: 'database', count: 8 },
];

export const mockTags = [
  { id: 1, name: 'React', slug: 'react', count: 18 },
  { id: 2, name: 'JavaScript', slug: 'javascript', count: 20 },
  { id: 3, name: 'Vite', slug: 'vite', count: 12 },
  { id: 4, name: 'TypeScript', slug: 'typescript', count: 15 },
  { id: 5, name: '测试', slug: 'test', count: 1 },
  { id: 6, name: 'KaTeX', slug: 'katex', count: 1 },
];

export const mockComments = [
  {
    id: 1,
    articleId: 1,
    author: {
      name: '张三',
      avatar: '/avatars/zhangsan.jpg',
    },
    content: '这篇文章写得很好，学到了很多！',
    createdAt: '2025-01-16T08:30:00Z',
    replies: [
      {
        id: 2,
        parentId: 1,
        author: {
          name: '博主名',
          avatar: '/avatar.jpg',
        },
        content: '谢谢支持！',
        createdAt: '2025-01-16T10:00:00Z',
      },
    ],
  },
];

export const mockUser = {
  id: 1,
  username: 'admin',
  name: '博主名',
  avatar: '/avatar.jpg',
  bio: '全栈开发者',
  email: 'admin@example.com',
  role: 'admin',
};

export default {
  mockArticles,
  mockCategories,
  mockTags,
  mockComments,
  mockUser,
};
