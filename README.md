# UniHub Official Plugins

官方插件仓库，包含所有 UniHub 官方维护的插件。

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建所有插件
pnpm run build:all

# 打包所有插件
pnpm run package:all

# 发布到 CDN
pnpm run publish:all
```

## 插件列表

查看 [marketplace/plugins.json](./marketplace/plugins.json) 获取完整插件列表。

## 开发指南

### 本地开发

```bash
cd plugins/your-plugin
pnpm install
pnpm run dev
```

### 构建插件

```bash
pnpm run build
pnpm run package
```

## 发布流程

1. 提交代码到 main 分支
2. GitHub Actions 自动构建
3. 自动上传到 CDN
4. 更新 marketplace/plugins.json
5. 主仓库自动同步

## License

MIT
