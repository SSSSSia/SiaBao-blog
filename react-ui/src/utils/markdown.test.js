import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown — 标题中的行内语法', () => {
  it('标题里的行内代码应渲染为 <code>', () => {
    const html = renderMarkdown('# 标题 `代码` 测试').__html;
    expect(html).toContain('<h1');
    expect(html).toContain('<code>代码</code>');
  });

  it('标题里的粗体/斜体/链接也应渲染', () => {
    const html = renderMarkdown('## H2 **粗** *斜* [链接](https://x.com)').__html;
    expect(html).toContain('<strong>粗</strong>');
    expect(html).toContain('<em>斜</em>');
    expect(html).toContain('<a href="https://x.com">');
  });

  it('普通标题仍正确渲染并带 id', () => {
    const html = renderMarkdown('# 普通标题').__html;
    expect(html).toContain('<h1');
    expect(html).toContain('普通标题</h1>');
  });
});
