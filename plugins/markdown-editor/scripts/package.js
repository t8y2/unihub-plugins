import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

async function packagePlugin() {
  console.log('📦 开始打包插件...')

  const packageJsonPath = path.join(rootDir, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  const unihubConfig = packageJson.unihub

  if (!unihubConfig) {
    throw new Error('package.json 中缺少 unihub 配置')
  }

  const distDir = path.join(rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    throw new Error('请先运行 npm run build 构建项目')
  }

  const zipPath = path.join(rootDir, 'plugin.zip')
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath)
  }

  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  output.on('close', () => {
    console.log(`✅ 插件打包完成: plugin.zip (${archive.pointer()} bytes)`)
  })

  archive.on('error', (err) => {
    throw err
  })

  archive.pipe(output)
  archive.file(packageJsonPath, { name: 'package.json' })
  archive.directory(distDir, 'dist')
  await archive.finalize()
}

packagePlugin().catch((err) => {
  console.error('❌ 打包失败:', err)
  process.exit(1)
})
