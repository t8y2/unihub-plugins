import archiver from 'archiver'
import { createWriteStream, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')
const outputPath = resolve(rootDir, 'plugin.zip')

// 检查 dist 目录是否存在
if (!existsSync(distDir)) {
  console.error('❌ dist 目录不存在！')
  console.log('请先构建 Ctool 并将构建产物复制到 dist 目录')
  process.exit(1)
}

const output = createWriteStream(outputPath)
const archive = archiver('zip', {
  zlib: { level: 9 }
})

output.on('close', () => {
  console.log('✅ 插件打包完成！')
  console.log(`📦 文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`)
  console.log(`📍 输出路径: ${outputPath}`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)

// 添加 package.json
archive.file(resolve(rootDir, 'package.json'), { name: 'package.json' })

// 添加 dist 目录
archive.directory(distDir, 'dist')

archive.finalize()
