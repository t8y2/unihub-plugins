# Markdown 编辑器

基于 [Vditor](https://github.com/Vanessa219/vditor) 的 Markdown 编辑器插件，支持实时预览、语法高亮、数学公式和图表。

## ✨ 功能特性

- 📝 **实时预览** - 即时渲染模式，所见即所得
- 🎨 **语法高亮** - 支持多种编程语言代码高亮
- 📐 **数学公式** - 支持 LaTeX 数学公式渲染
- 📊 **图表支持** - 支持 Mermaid 流程图和图表
- 💾 **自动保存** - 内容自动保存到本地存储
- 📤 **导出功能** - 支持导出 HTML 和 Markdown
- 🎯 **字数统计** - 实时显示字数和字符数
- 📋 **快捷操作** - 丰富的工具栏快捷按钮

## 🚀 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 打包插件

```bash
npm run package
```

生成的 `plugin.zip` 可以直接拖拽到 UniHub 中安装。

## 📖 使用说明

1. **编辑模式**：支持即时渲染模式，边写边看效果
2. **工具栏**：提供常用的 Markdown 格式化工具
3. **导出**：点击顶部工具栏的导出按钮，可以导出为 HTML 或 Markdown
4. **自动保存**：内容每 3 秒自动保存一次

## 🛠️ 技术栈

- Vue 3 - 渐进式 JavaScript 框架
- TypeScript - 类型安全
- [Vditor](https://github.com/Vanessa219/vditor) - 强大的 Markdown 编辑器内核
- Vite - 快速的构建工具

## 📚 关于 Vditor

本插件基于 [Vditor](https://github.com/Vanessa219/vditor) 开发，Vditor 是一款浏览器端的 Markdown 编辑器，支持所见即所得、即时渲染和分屏预览模式。感谢 Vditor 团队的优秀工作！

## 📝 Markdown 语法支持

- 标题、段落、列表
- 代码块和行内代码
- 表格
- 引用
- 链接和图片
- 任务列表
- 数学公式（LaTeX）
- Mermaid 图表
- 更多...

## 🔒 权限说明

- `clipboard` - 用于复制导出的内容
- `fs` - 用于文件读写（可选）
- `storage` - 用于保存编辑内容

## 📄 许可证

MIT
