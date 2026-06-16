/**
 * 探索页面数据 — 前沿热点追踪
 * 手动维护的静态数据，定期更新
 */

// ===================================
// 展区配置
// ===================================
export const EXPLORE_SECTIONS = [
  {
    id: 'tech-radar',
    title: '技术雷达',
    icon: 'Radar',
    size: 'large',
    description: '技术趋势全景图，追踪值得关注的技术动向',
  },
  {
    id: 'ai-trends',
    title: 'AI 前沿',
    icon: 'Brain',
    size: 'tall',
    description: '人工智能领域的最新突破与趋势',
  },
  {
    id: 'hot-topics',
    title: '热门话题',
    icon: 'TrendingUp',
    size: 'wide',
    description: '当前技术社区最热门的讨论话题',
  },
  {
    id: 'dev-tools',
    title: '工具箱',
    icon: 'Wrench',
    size: 'normal',
    description: '提升开发效率的精选工具推荐',
  },
  {
    id: 'learning',
    title: '学习路线',
    icon: 'GraduationCap',
    size: 'normal',
    description: '结构化的技术学习路径规划',
  },
  {
    id: 'open-source',
    title: '开源精选',
    icon: 'GitBranch',
    size: 'normal',
    description: '值得关注的高质量开源项目',
  },
]

// ===================================
// 技术雷达数据
// ===================================
export const RADAR_RINGS = [
  { id: 'adopt', label: '采用', description: '推荐用于生产环境的成熟技术' },
  { id: 'trial', label: '试用', description: '值得在项目中尝试的技术' },
  { id: 'assess', label: '评估', description: '值得探索和研究的新兴技术' },
  { id: 'hold', label: '暂缓', description: '不建议在新项目中使用' },
]

export const RADAR_CATEGORIES = [
  { id: 'languages', label: '语言', angleRange: [-45, 45] },
  { id: 'frameworks', label: '框架', angleRange: [45, 135] },
  { id: 'tools', label: '工具', angleRange: [135, 225] },
  { id: 'platforms', label: '平台', angleRange: [225, 315] },
]

export const RADAR_ITEMS = [
  // === 语言 ===
  { id: 'typescript', name: 'TypeScript', ring: 'adopt', category: 'languages', desc: '类型安全的 JavaScript 超集，已成为大型项目标配', tags: ['前端', '类型系统'] },
  { id: 'rust', name: 'Rust', ring: 'trial', category: 'languages', desc: '系统级编程语言，内存安全零成本抽象', tags: ['系统编程', 'WebAssembly'] },
  { id: 'go', name: 'Go', ring: 'adopt', category: 'languages', desc: '简洁高效的并发编程语言，云原生基础设施首选', tags: ['后端', '云原生'] },
  { id: 'python', name: 'Python', ring: 'adopt', category: 'languages', desc: 'AI/ML 领域的绝对主力语言，生态极其丰富', tags: ['AI', '数据科学'] },
  { id: 'zig', name: 'Zig', ring: 'assess', category: 'languages', desc: 'C 语言的现代替代者，系统编程新选择', tags: ['系统编程', '底层'] },
  { id: 'mojo', name: 'Mojo', ring: 'assess', category: 'languages', desc: 'Python 的超集语言，AI 专用高性能编程', tags: ['AI', '高性能'] },

  // === 框架 ===
  { id: 'react-19', name: 'React 19', ring: 'adopt', category: 'frameworks', desc: 'Server Components、Actions、use() 等重要特性', tags: ['前端', 'UI'] },
  { id: 'nextjs', name: 'Next.js 15', ring: 'adopt', category: 'frameworks', desc: '全栈 React 框架，App Router 日趋成熟', tags: ['全栈', 'SSR'] },
  { id: 'vite', name: 'Vite', ring: 'adopt', category: 'frameworks', desc: '极快的下一代前端构建工具，已成为主流', tags: ['构建工具', '前端'] },
  { id: 'astro', name: 'Astro', ring: 'trial', category: 'frameworks', desc: '内容优先的 Web 框架，岛屿架构', tags: ['静态站点', '内容'] },
  { id: 'htmx', name: 'HTMX', ring: 'trial', category: 'frameworks', desc: '用 HTML 属性实现现代交互，回归简洁', tags: ['HTML', '超媒体'] },
  { id: 'tailwind-v4', name: 'Tailwind CSS v4', ring: 'adopt', category: 'frameworks', desc: 'CSS-first 配置，性能大幅提升', tags: ['CSS', '样式'] },
  { id: 'tauri', name: 'Tauri', ring: 'assess', category: 'frameworks', desc: '轻量级跨平台桌面应用框架', tags: ['桌面端', 'Rust'] },

  // === 工具 ===
  { id: 'cursor', name: 'Cursor', ring: 'adopt', category: 'tools', desc: 'AI 驱动的代码编辑器，编程效率革新', tags: ['编辑器', 'AI'] },
  { id: 'docker', name: 'Docker', ring: 'adopt', category: 'tools', desc: '容器化部署的标准工具链', tags: ['容器', '部署'] },
  { id: 'biome', name: 'Biome', ring: 'trial', category: 'tools', desc: '极速的前端工具链（lint + format），Rust 编写', tags: ['Lint', '格式化'] },
  { id: 'bun', name: 'Bun', ring: 'trial', category: 'tools', desc: '全能 JavaScript 运行时，速度极快', tags: ['运行时', '全栈'] },
  { id: 'turbopack', name: 'Turbopack', ring: 'assess', category: 'tools', desc: 'Vercel 推出的增量打包器', tags: ['构建', '性能'] },
  { id: 'copilot', name: 'GitHub Copilot', ring: 'adopt', category: 'tools', desc: 'AI 代码补全助手，已成为开发者标配', tags: ['AI', '编程助手'] },

  // === 平台 ===
  { id: 'vercel', name: 'Vercel', ring: 'adopt', category: 'platforms', desc: '前端部署平台，零配置开箱即用', tags: ['部署', 'Serverless'] },
  { id: 'cloudflare', name: 'Cloudflare', ring: 'adopt', category: 'platforms', desc: '边缘计算 + Workers，全球 CDN 加速', tags: ['边缘计算', 'CDN'] },
  { id: 'supabase', name: 'Supabase', ring: 'trial', category: 'platforms', desc: '开源的 Firebase 替代品，Postgres + Auth + Storage', tags: ['BaaS', '数据库'] },
  { id: 'huggingface', name: 'Hugging Face', ring: 'adopt', category: 'platforms', desc: 'AI 模型和数据集的 GitHub', tags: ['AI', '开源'] },
  { id: 'deno', name: 'Deno', ring: 'hold', category: 'platforms', desc: 'Node 的替代运行时，生态仍在追赶中', tags: ['运行时', 'JavaScript'] },
  { id: 'railway', name: 'Railway', ring: 'assess', category: 'platforms', desc: '极简的后端部署平台，开发者体验优先', tags: ['部署', 'PaaS'] },
]

// ===================================
// AI 前沿数据
// ===================================
export const AI_TRENDS_DATA = [
  {
    id: 'ai-agents',
    title: 'AI Agents 智能体',
    desc: '基于大语言模型的自主代理系统，能够规划、推理、使用工具完成复杂任务。从简单的 ChatBot 到可自主决策的 Agent，代表了 AI 应用的下一个范式。',
    tags: ['LLM', '自主决策', '工具使用'],
    date: '2025-06',
    highlight: true,
  },
  {
    id: 'multimodal',
    title: '多模态 AI',
    desc: '融合文本、图像、音频、视频的统一 AI 模型。GPT-4o、Gemini 等展现了同时理解和生成多种模态的能力。',
    tags: ['视觉', '语音', '理解'],
    date: '2025-06',
    highlight: false,
  },
  {
    id: 'code-gen',
    title: 'AI 代码生成',
    desc: '从 Copilot 到 Cursor，AI 辅助编程已成为开发者日常。AI 编程工具正在从补全代码进化到自主构建功能模块。',
    tags: ['编程', 'Vibe Coding', '效率'],
    date: '2025-05',
    highlight: true,
  },
  {
    id: 'local-llm',
    title: '本地大模型',
    desc: 'Ollama、llama.cpp 等工具让在本地运行大模型成为现实。Llama 3、Qwen 等开源模型质量飞速提升，隐私和成本优势显著。',
    tags: ['开源', '本地部署', '隐私'],
    date: '2025-05',
    highlight: false,
  },
  {
    id: 'rag',
    title: 'RAG 检索增强生成',
    desc: '结合外部知识库与 LLM 的检索增强技术，有效缓解幻觉问题，是企业级 AI 应用的核心技术架构。',
    tags: ['知识库', '企业应用', '可靠性'],
    date: '2025-04',
    highlight: false,
  },
  {
    id: 'ai-video',
    title: 'AI 视频生成',
    desc: 'Sora、Kling、Runway 等模型让 AI 生成视频质量达到实用级别，创意产业的 AI 革命加速到来。',
    tags: ['视频', '生成式', '创意'],
    date: '2025-04',
    highlight: false,
  },
]

// ===================================
// 热门话题数据
// ===================================
export const HOT_TOPICS_DATA = [
  { id: 'vibe-coding', title: 'Vibe Coding', desc: '用自然语言描述需求，让 AI 生成完整应用。从"写代码"到"描述需求"的范式转变。', tags: ['AI', '开发方式', '趋势'] },
  { id: 'edge-computing', title: '边缘计算', desc: '计算从云端下沉到边缘节点，低延迟场景的必然选择。', tags: ['架构', '性能', '基础设施'] },
  { id: 'rust-everywhere', title: 'Rust 无处不在', desc: '从 Linux 内核到 Web 前端，Rust 正在渗透到每个技术领域。', tags: ['Rust', '系统编程', '趋势'] },
  { id: 'serverless', title: 'Serverless 2.0', desc: '从函数到容器，Serverless 理念持续演进，冷启动问题逐步解决。', tags: ['架构', '云原生', '部署'] },
  { id: 'web-standards', title: 'Web 标准新特性', desc: 'View Transitions、Container Queries、Popover API 等新标准改变前端开发。', tags: ['前端', '标准', 'CSS'] },
  { id: 'ai-safety', title: 'AI 安全与对齐', desc: '随着 AI 能力增强，安全对齐和可控性成为关键议题。', tags: ['AI', '安全', '伦理'] },
  { id: 'crdt', title: 'CRDT 协同编辑', desc: '无冲突的分布式数据结构，驱动下一代实时协作工具。', tags: ['协作', '分布式', '算法'] },
  { id: 'spatial-computing', title: '空间计算', desc: 'Vision Pro 之后的空间计算浪潮，XR 与日常计算的融合。', tags: ['XR', '交互', '硬件'] },
]

// ===================================
// 开发者工具箱数据
// ===================================
export const DEV_TOOLS_DATA = [
  {
    category: 'AI 辅助',
    items: [
      { name: 'Cursor', desc: 'AI-first 代码编辑器，内置深度代码理解' },
      { name: 'GitHub Copilot', desc: 'AI 编程助手，代码补全与建议' },
      { name: 'Cline', desc: 'VSCode AI 编程插件，自主执行复杂任务' },
    ],
  },
  {
    category: '终端 & Shell',
    items: [
      { name: 'Warp', desc: '现代化终端，AI 命令搜索和自动补全' },
      { name: 'Starship', desc: '快速、可定制的跨平台 Shell 提示符' },
      { name: 'Zellij', desc: '现代终端复用器，Rust 编写' },
    ],
  },
  {
    category: '开发效率',
    items: [
      { name: 'Raycast', desc: 'Mac 效率启动器，替代 Alfred' },
      { name: 'Arc Browser', desc: '重新定义浏览器的组织方式' },
      { name: 'Linear', desc: '现代项目管理工具，极致的开发者体验' },
    ],
  },
  {
    category: 'API & 调试',
    items: [
      { name: 'Hoppscotch', desc: '开源 API 测试工具，轻量快速' },
      { name: 'HTTPie', desc: '人性化的命令行 HTTP 客户端' },
      { name: 'Zed', desc: '高性能代码编辑器，Rust + GPUI' },
    ],
  },
]

// ===================================
// 学习路线数据
// ===================================
export const LEARNING_PATHS_DATA = [
  {
    id: 'frontend-2025',
    title: '现代前端开发',
    description: '从 HTML/CSS 到 React 生态的完整前端学习路径',
    steps: [
      { label: '基础', title: 'HTML + CSS + JavaScript', status: 'foundation' },
      { label: '进阶', title: 'TypeScript + 模块化', status: 'intermediate' },
      { label: '框架', title: 'React 19 + Next.js', status: 'advanced' },
      { label: '工具链', title: 'Vite + Tailwind + Biome', status: 'advanced' },
    ],
  },
  {
    id: 'fullstack',
    title: '全栈开发',
    description: '前后端一体的全栈工程师成长路线',
    steps: [
      { label: '前端', title: 'React + TypeScript', status: 'foundation' },
      { label: '后端', title: 'Node.js / Python FastAPI', status: 'intermediate' },
      { label: '数据库', title: 'PostgreSQL + Redis', status: 'intermediate' },
      { label: '部署', title: 'Docker + CI/CD', status: 'advanced' },
    ],
  },
  {
    id: 'ai-engineering',
    title: 'AI 工程师',
    description: '掌握 AI 应用开发的核心技能树',
    steps: [
      { label: '基础', title: 'Python + 机器学习基础', status: 'foundation' },
      { label: '模型', title: 'LLM API + Prompt Engineering', status: 'intermediate' },
      { label: '应用', title: 'RAG + Agents 开发', status: 'advanced' },
      { label: '部署', title: '模型微调 + 推理优化', status: 'expert' },
    ],
  },
  {
    id: 'devops',
    title: 'DevOps 工程师',
    description: '从开发到运维的全链路自动化能力',
    steps: [
      { label: '基础', title: 'Linux + Shell + Git', status: 'foundation' },
      { label: '容器', title: 'Docker + Kubernetes', status: 'intermediate' },
      { label: 'CI/CD', title: 'GitHub Actions + ArgoCD', status: 'advanced' },
      { label: '可观测', title: 'Prometheus + Grafana', status: 'advanced' },
    ],
  },
]

// ===================================
// 开源精选数据
// ===================================
export const OPEN_SOURCE_DATA = [
  {
    name: 'Shadcn/ui',
    desc: '可复制粘贴的组件库，非 npm 包，代码归你所有',
    tags: ['React', 'UI 组件'],
    stars: '78k+',
    url: 'https://github.com/shadcn-ui/ui',
  },
  {
    name: 'Ollama',
    desc: '在本地一键运行开源大模型，简单到不可思议',
    tags: ['AI', '本地部署'],
    stars: '110k+',
    url: 'https://github.com/ollama/ollama',
  },
  {
    name: 'Tauri',
    desc: '用 Web 技术构建更小、更快、更安全的桌面应用',
    tags: ['桌面端', 'Rust'],
    stars: '90k+',
    url: 'https://github.com/tauri-apps/tauri',
  },
  {
    name: 'Hono',
    desc: '超快速的 Web 框架，适用于 Edge 和 Cloudflare Workers',
    tags: ['后端', '边缘计算'],
    stars: '22k+',
    url: 'https://github.com/honojs/hono',
  },
  {
    name: 'Zed',
    desc: 'Rust 编写的高性能代码编辑器，协作优先',
    tags: ['编辑器', '工具'],
    stars: '35k+',
    url: 'https://github.com/zed-industries/zed',
  },
  {
    name: 'McpHub',
    desc: 'MCP 协议工具和模型的市场与发现平台',
    tags: ['AI', 'MCP'],
    stars: '15k+',
    url: 'https://github.com/punkpeye/mcp-hub',
  },
]

// ===================================
// Hero 区域统计
// ===================================
export const EXPLORE_STATS = {
  totalTopics: RADAR_ITEMS.length + AI_TRENDS_DATA.length + HOT_TOPICS_DATA.length,
  totalTools: DEV_TOOLS_DATA.reduce((sum, cat) => sum + cat.items.length, 0),
  totalPaths: LEARNING_PATHS_DATA.length,
  totalProjects: OPEN_SOURCE_DATA.length,
  lastUpdated: '2025-06',
}
