# 代码对比工具

基于 Monaco Editor 的强大代码差异对比功能，支持语法高亮和多种编程语言。

## 功能特性

- 🎨 **Monaco Editor** - 使用 VS Code 同款编辑器内核
- 🔄 **实时对比** - 并排或内联模式查看代码差异
- 🌈 **语法高亮** - 支持 19+ 种编程语言
- 🌓 **主题切换** - 亮色/暗色主题自由切换
- 💾 **自动保存** - 自动保存编辑内容到本地
- 📋 **剪贴板支持** - 快速粘贴代码进行对比
- 🔁 **交换功能** - 一键交换左右代码

## 支持的语言

JavaScript, TypeScript, Python, Java, C#, C++, Go, Rust, PHP, Ruby, HTML, CSS, JSON, XML, YAML, Markdown, SQL, Shell, Plain Text

## 技术栈

- Vue 3
- TypeScript
- Monaco Editor
- Radix Vue
- Vite

## 开发

\`\`\`bash
cd official-plugins/code-diff
pnpm install
pnpm run dev
\`\`\`

## 构建

\`\`\`bash
pnpm run build
\`\`\`

## 打包

\`\`\`bash
pnpm run package
\`\`\`

## 插件信息

- **ID**: com.unihub.code-diff
- **分类**: tool
- **权限**: clipboard, storage
