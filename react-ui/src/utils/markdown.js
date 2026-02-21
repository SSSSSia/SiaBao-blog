/**
 * Markdown 渲染工具
 * 支持：Markdown 解析、代码高亮、数学公式、XSS 防护
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css'; // 使用 GitHub 样式

// 处理数学公式的辅助函数
function renderMath(text, displayMode = false) {
  try {
    return katex.renderToString(text, {
      throwOnError: false,
      displayMode: displayMode,
      strict: false,
      output: 'html', // 使用 HTML 输出而不是 MathML
      fleqn: false, // 不使用左对齐公式
      leqno: false, // 不使用左对齐编号
      font: 'mathrm', // 使用数学字体
      macros: {
        // 自定义宏
        "\\RR": "\\mathbb{R}",
        "\\NN": "\\mathbb{N}",
        "\\ZZ": "\\mathbb{Z}",
        "\\CC": "\\mathbb{C}",
      },
    });
  } catch (error) {
    console.error('KaTeX 渲染失败:', error);
    return text; // 渲染失败时返回原文
  }
}

// 预处理 Markdown：处理顺序必须是 提取代码 -> 提取公式 -> 恢复代码
function preprocessMarkdown(markdown) {
  const mathBlocks = [];
  const codeBlocks = [];
  let text = markdown;

  // 1. 提取并保护多行代码块（修复换行符和无语言声明时的匹配问题）
  // 使用 [\s\S]*? 安全匹配所有内容
  text = text.replace(/```[\s\S]*?```/g, (match, offset) => {
    const placeholder = `__CODE_BLOCK_${offset}__`;
    codeBlocks.push({ placeholder, original: match });
    return placeholder;
  });

  // 2. 提取并保护单行代码块（严禁跨行，防止破坏文档结构）
  text = text.replace(/`[^`\n]+`/g, (match, offset) => {
    const placeholder = `__INLINE_CODE_${offset}__`;
    codeBlocks.push({ placeholder, original: match });
    return placeholder;
  });

  // 3. 处理块级公式 $$...$$
  let blockIndex = 0;
  text = text.replace(/^\$\$([\s\S]+?)\$\$/gm, (_match, formula) => {
    const placeholder = `__MATH_BLOCK_${blockIndex}__`;
    const html = renderMath(formula.trim(), true);
    mathBlocks.push({ placeholder, html });
    blockIndex++;
    return placeholder;
  });

  // 4. 处理行内公式 $...$
  let inlineIndex = 0;
  text = text.replace(/\$([^$\n]+?)\$/g, (_match, formula) => {
    // 过滤掉日常文本中的纯数字美元符号（如 $100）
    if (/^\d+(\.\d+)?$/.test(formula.trim())) return _match;
    const placeholder = `__MATH_INLINE_${inlineIndex}__`;
    const html = renderMath(formula.trim(), false);
    mathBlocks.push({ placeholder, html });
    inlineIndex++;
    return placeholder;
  });

  // 5. 【关键修复】在交给 marked 解析前，把代码块恢复为 Markdown！
  // 注意：必须使用 () => original，防止代码里的 $ 符号被 js 的 replace 方法误识别为正则变量
  codeBlocks.forEach(({ placeholder, original }) => {
    text = text.replace(new RegExp(placeholder, 'g'), () => original);
  });

  return {
    processed: text, // 此时文本包含原始代码块，但数学公式变成了占位符
    mathBlocks,
  };
}

// 用于生成唯一 ID 的计数器
const headingIds = new Map();

// 重置 heading 计数器（用于新文章）
function resetHeadingIds() {
  headingIds.clear();
}

// 生成标题 ID
function generateHeadingId(text) {
  const baseId = String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]/g, '');

  const safeBaseId = baseId || 'section';
  const count = headingIds.get(safeBaseId) || 0;
  headingIds.set(safeBaseId, count + 1);

  return count === 0 ? safeBaseId : `${safeBaseId}-${count}`;
}

// 配置 marked renderer
const renderer = new marked.Renderer();

// 自定义标题渲染，添加 id
renderer.heading = function({ text, depth, raw }) {
  const id = generateHeadingId(raw);
  return `<h${depth} id="${id}" data-heading-id="${id}">${text}</h${depth}>\n`;
};

// 配置 marked 选项
marked.setOptions({
  renderer: renderer,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('代码高亮失败:', err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true,
});

/**
 * 修复格式不正确的表格
 * 检测缺少分隔符行的表格并自动添加
 * @param {string} markdown - Markdown 内容
 * @returns {string} 修复后的 Markdown 内容
 */
function fixMalformedTables(markdown) {
  // 分割内容为行
  const lines = markdown.split('\n');
  const result = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableRow = line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|');
    const isSeparator = isTableRow && line.includes('---');

    // 如果不是表格行，重置状态
    if (!isTableRow) {
      inTable = false;
      result.push(line);
      continue;
    }

    // 如果是分隔符行，标记我们在表格中
    if (isSeparator) {
      inTable = true;
      result.push(line);
      continue;
    }

    // 如果是普通表格行
    if (inTable) {
      // 已经在表格中，直接添加
      result.push(line);
    } else {
      // 新表格的开始，检查下一行
      result.push(line);
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextIsTableRow = nextLine.includes('|') && nextLine.trim().startsWith('|') && nextLine.trim().endsWith('|');
        const nextIsSeparator = nextIsTableRow && nextLine.includes('---');

        // 如果下一行是表格数据行（不是分隔符），需要插入分隔符
        if (nextIsTableRow && !nextIsSeparator) {
          // 分析表头，确定列数
          const columns = line.split('|').filter(cell => cell.trim() !== '').length;
          // 生成分隔符行（左对齐）
          const separator = '|' + '---|'.repeat(columns);
          result.push(separator);
          inTable = true;
        }
      }
    }
  }

  return result.join('\n');
}

/**
 * 自动修复 Markdown 格式问题
 * 在块级元素前插入必要的空行
 * @param {string} markdown - Markdown 内容
 * @returns {string} 修复后的 Markdown 内容
 */
function autoFixMarkdownGaps(markdown) {
  if (!markdown) return '';

  // 分割成行进行处理，更精确控制
  const lines = markdown.split('\n');
  const result = [];

  let inCodeBlock = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测代码块状态
    if (/^```/.test(trimmedLine)) {
      // 在代码块结束前
      if (!inCodeBlock) {
        // 这是代码块开始
        const prevLine = i > 0 ? lines[i - 1] : '';
        const prevLineIsContent = prevLine.trim() !== '';

        // 如果上一行有内容但没有空行，插入空行
        if (prevLineIsContent) {
          result.push('');
        }
      }
      inCodeBlock = !inCodeBlock;
      inTable = false; // 代码块结束表格
      result.push(line);
      continue;
    }

    // 在代码块内，直接添加，不做处理
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // 检测表格状态
    const isTableRow = /^\|.*\|$/.test(trimmedLine);
    if (isTableRow) {
      if (!inTable) {
        // 这是表格的第一行
        const prevLine = i > 0 ? lines[i - 1] : '';
        const prevLineIsContent = prevLine.trim() !== '';

        if (prevLineIsContent) {
          result.push('');
        }
        inTable = true;
      }
      result.push(line);
      continue;
    }

    // 非表格行，结束表格状态
    inTable = false;

    // 检查当前行是否是其他块级元素开始
    const isHeading = /^#{1,6}\s/.test(trimmedLine);
    const isListStart = /^[*\-+] |\d+\. /.test(trimmedLine);
    const isBlockquote = /^>/.test(trimmedLine);

    // 检查上一行是否是空行
    const prevLine = i > 0 ? lines[i - 1] : '';
    const prevLineIsContent = prevLine.trim() !== '';

    // 如果当前行是块级元素开始，且上一行有内容但没有空行，插入空行
    if ((isHeading || isListStart || isBlockquote) && prevLineIsContent) {
      result.push('');
    }

    result.push(line);
  }

  let text = result.join('\n');

  // 清理多余的空行（超过 2 个连续空行的压缩为 2 个）
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

/**
 * 将 Markdown 转换为安全的 HTML
 * @param {string} markdown - Markdown 内容
 * @returns {Object} 包含 __html 属性的对象，用于 dangerouslySetInnerHTML
 */
export function renderMarkdown(markdown) {
  if (!markdown) return { __html: '' };

  // 重置标题 ID 计数器
  resetHeadingIds();

  try {
    // 0. 首先修复 Markdown 格式问题（缺少空行等）
    const gapFixedMarkdown = autoFixMarkdownGaps(markdown);

    // 1. 修复格式不正确的表格
    const fixedMarkdown = fixMalformedTables(gapFixedMarkdown);

    // 2. 预处理：保护公式，同时保留代码块供 marked 解析
    const { processed, mathBlocks } = preprocessMarkdown(fixedMarkdown);

    // 2. 将处理后的 Markdown 转换为 HTML (此时 marked 会正确处理标题、代码和表格)
    const rawHtml = marked(processed);

    // 3. 后处理：只替换数学公式的 HTML 占位符
    let processedHtml = rawHtml;
    mathBlocks.forEach(({ placeholder, html: mathHtml }) => {
      // 同样使用 () => mathHtml 防止意外的正则捕获替换
      processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), () => mathHtml);
    });

    // 4. 使用 DOMPurify 清理 HTML（你的原始配置很完善，保持不变即可）
    const cleanHtml = DOMPurify.sanitize(processedHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'a',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote',
        'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img',
        'hr',
        'div', 'span',
        // KaTeX 相关标签
        'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'mtext',
        'mspace', 'msqrt', 'mfrac', 'msub', 'msup', 'msubsup',
        'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd',
        'annotation', 'svg', 'path',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'target',
        'class', 'id',
        'data-*',
        'style', // <--- 【关键修复】添加这一行
        // KaTeX 相关属性
        'xmlns', 'viewBox', 'width', 'height', 'preserveAspectRatio',
        'd', 'stroke', 'stroke-width', 'fill', 'stroke-linecap',
        'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset',
        'stroke-miterlimit', 'encoding',
        'aria-hidden', // 建议添加：KaTeX 经常使用这个属性来辅助无障碍访问
      ],
      ALLOW_DATA_ATTR: true,
      // 强制保留标题标签的 id 属性
      ADD_ATTR: ['id'],
    });

    return { __html: cleanHtml };
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    return { __html: '<p>内容渲染失败</p>' };
  }
}

/**
 * 从 Markdown 内容中提取摘要
 * @param {string} markdown - Markdown 内容
 * @param {number} length - 摘要长度（字符数）
 * @returns {string} 摘要文本
 */
export function extractExcerpt(markdown, length = 200) {
  if (!markdown) return '';

  // 移除 Markdown 语法标记
  const plainText = markdown
    .replace(/#{1,6}\s+/g, '') // 标题
    .replace(/\*\*.*?\*\*/g, '') // 粗体
    .replace(/\*.*?\*/g, '') // 斜体
    .replace(/`.*?`/g, '') // 行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
    .replace(/\[.*?\]\(.*?\)/g, '') // 链接
    .replace(/>\s+/g, '') // 引用
    .replace(/\n+/g, ' ') // 换行
    .trim();

  // 截取指定长度
  if (plainText.length <= length) {
    return plainText;
  }

  return plainText.slice(0, length) + '...';
}

/**
 * 从 Markdown 内容中提取标题列表（用于生成目录）
 * @param {string} markdown - Markdown 内容
 * @returns {Array} 标题数组 { id, text, level }
 */
export function extractHeadings(markdown) {
  if (!markdown) return [];

  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-\u4e00-\u9fa5]/g, '');

    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * 估算阅读时间
 * @param {string} markdown - Markdown 内容
 * @param {number} wordsPerMinute - 每分钟阅读字数（默认 200）
 * @returns {number} 阅读时间（分钟）
 */
export function estimateReadingTime(markdown, wordsPerMinute = 200) {
  if (!markdown) return 0;

  // 统计中文字符数（每个汉字算一个词）
  const chineseChars = (markdown.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计英文单词数
  const englishWords = (markdown.match(/[a-zA-Z]+/g) || []).length;

  const totalWords = chineseChars + englishWords;
  const readingTime = Math.ceil(totalWords / wordsPerMinute);

  return Math.max(1, readingTime); // 至少 1 分钟
}

export default {
  renderMarkdown,
  extractExcerpt,
  extractHeadings,
  estimateReadingTime,
  generateHeadingId,
  resetHeadingIds,
};
