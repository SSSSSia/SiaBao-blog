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

describe('renderMarkdown — CJK 加粗侧翼修复', () => {
  it('加粗以全角括号结尾且后紧贴汉字时应补空格正常加粗', () => {
    const html = renderMarkdown('**几率（Odds）**是指成功概率与失败概率之比。').__html;
    expect(html).toContain('<strong>几率（Odds）</strong>');
    expect(html).not.toContain('**几率');
  });

  it('加粗以符号/引号结尾同理（% 与全角引号）', () => {
    const html = renderMarkdown('**90%**的用户').__html;
    expect(html).toContain('<strong>90%</strong>');
    const html2 = renderMarkdown('**“证据”**理论').__html;
    expect(html2).toContain('<strong>“证据”</strong>');
  });

  it('本就正常的形态不受影响', () => {
    // 闭合 ** 前是汉字 → 无需修复
    const html = renderMarkdown('**几率**是指两者之比。').__html;
    expect(html).toContain('<strong>几率</strong>是指');
    // 外层全角括号包裹
    const html2 = renderMarkdown('（**几率**）是关键').__html;
    expect(html2).toContain('（<strong>几率</strong>）是关键');
    // 闭合 ** 后跟标点
    const html3 = renderMarkdown('**几率（Odds）**：核心概念').__html;
    expect(html3).toContain('<strong>几率（Odds）</strong>：');
  });

  it('修复不污染代码块内容', () => {
    const md = '正文 **x）**是 加粗。\n\n```\nconst s = "**a）**是"\n```\n';
    const html = renderMarkdown(md).__html;
    // 正文加粗被修复
    expect(html).toContain('<strong>x）</strong>');
    // 代码块内容原样保留（不插入空格）
    expect(html).toContain('**a）**是');
  });
});
