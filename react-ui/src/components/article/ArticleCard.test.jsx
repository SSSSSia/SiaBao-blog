/**
 * ArticleCard 组件测试
 * 测试文章卡片的渲染和交互
 */

import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ArticleCard from './ArticleCard'

// Mock dayjs
vi.mock('dayjs', () => ({
  default: (date) => ({
    format: (fmt) => {
      const d = new Date(date)
      if (fmt === 'YYYY-MM-DD') {
        return d.toISOString().split('T')[0]
      }
      return d.toISOString()
    }
  })
}))

const mockArticle = {
  id: 1,
  title: '测试文章标题',
  excerpt: '这是一篇测试文章的摘要',
  category: { id: 1, name: '技术', slug: 'tech' },
  tags: [
    { id: 1, name: 'React', slug: 'react' },
    { id: 2, name: '测试', slug: 'test' }
  ],
  stats: {
    views: 100,
    likes: 25
  },
  publishedAt: '2024-01-15T10:00:00Z',
  readingTime: 5
}

describe('ArticleCard 组件', () => {
  it('应该正确渲染文章基本信息', () => {
    render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} />
      </BrowserRouter>
    )

    expect(screen.getByText('测试文章标题')).toBeInTheDocument()
    expect(screen.getByText('这是一篇测试文章的摘要')).toBeInTheDocument()
  })

  it('应该显示文章分类', () => {
    render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} />
      </BrowserRouter>
    )

    expect(screen.getByText('技术')).toBeInTheDocument()
  })

  it('应该显示所有标签', () => {
    render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} />
      </BrowserRouter>
    )

    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('测试')).toBeInTheDocument()
  })

  it('应该显示文章统计数据', () => {
    render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} />
      </BrowserRouter>
    )

    expect(screen.getByText('100')).toBeInTheDocument() // views
    expect(screen.getByText('25')).toBeInTheDocument() // likes
    expect(screen.getByText('5 分钟')).toBeInTheDocument()
  })

  it('应该有正确的链接地址', () => {
    render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} />
      </BrowserRouter>
    )

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/articles/1')
  })

  it('featured 模式应该添加特殊类名', () => {
    const { container } = render(
      <BrowserRouter>
        <ArticleCard article={mockArticle} featured={true} />
      </BrowserRouter>
    )

    const article = container.querySelector('.article-card')
    expect(article).toHaveClass('article-card-featured')
  })

  it('没有摘要时不应渲染摘要部分', () => {
    const articleWithoutExcerpt = { ...mockArticle, excerpt: null }

    const { container } = render(
      <BrowserRouter>
        <ArticleCard article={articleWithoutExcerpt} />
      </BrowserRouter>
    )

    const excerpt = container.querySelector('.article-card-excerpt')
    expect(excerpt).not.toBeInTheDocument()
  })
})
