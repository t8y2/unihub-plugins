import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

async function copyAssets() {
  try {
    // 复制 Excalidraw 生产环境资源文件到 dist
    const excalidrawProdSource = join(rootDir, 'node_modules/@excalidraw/excalidraw/dist/prod')
    const excalidrawProdTarget = join(rootDir, 'dist/excalidraw-assets')
    
    if (await fs.pathExists(excalidrawProdSource)) {
      // 复制字体文件
      const fontsSource = join(excalidrawProdSource, 'fonts')
      const fontsTarget = join(excalidrawProdTarget, 'fonts')
      if (await fs.pathExists(fontsSource)) {
        await fs.copy(fontsSource, fontsTarget)
        console.log('✅ 字体文件复制到 dist 完成')
      }

      // 复制本地化文件
      const localesSource = join(excalidrawProdSource, 'locales')
      const localesTarget = join(excalidrawProdTarget, 'locales')
      if (await fs.pathExists(localesSource)) {
        await fs.copy(localesSource, localesTarget)
        console.log('✅ 本地化文件复制到 dist 完成')
      }

      // 复制数据文件
      const dataSource = join(excalidrawProdSource, 'data')
      const dataTarget = join(excalidrawProdTarget, 'data')
      if (await fs.pathExists(dataSource)) {
        await fs.copy(dataSource, dataTarget)
        console.log('✅ 数据文件复制到 dist 完成')
      }
    } else {
      console.warn('⚠️  未找到 Excalidraw 生产环境资源文件')
    }

    // 复制开发环境资源文件到 public (用于开发)
    const excalidrawDevSource = join(rootDir, 'node_modules/@excalidraw/excalidraw/dist/dev')
    const excalidrawDevTarget = join(rootDir, 'public/excalidraw-assets')
    
    if (await fs.pathExists(excalidrawDevSource)) {
      // 复制字体文件
      const fontsDevSource = join(excalidrawDevSource, 'fonts')
      const fontsDevTarget = join(excalidrawDevTarget, 'fonts')
      if (await fs.pathExists(fontsDevSource)) {
        await fs.copy(fontsDevSource, fontsDevTarget)
        console.log('✅ 开发环境字体文件复制到 public 完成')
      }

      // 复制本地化文件
      const localesDevSource = join(excalidrawDevSource, 'locales')
      const localesDevTarget = join(excalidrawDevTarget, 'locales')
      if (await fs.pathExists(localesDevSource)) {
        await fs.copy(localesDevSource, localesDevTarget)
        console.log('✅ 开发环境本地化文件复制到 public 完成')
      }

      // 复制数据文件
      const dataDevSource = join(excalidrawDevSource, 'data')
      const dataDevTarget = join(excalidrawDevTarget, 'data')
      if (await fs.pathExists(dataDevSource)) {
        await fs.copy(dataDevSource, dataDevTarget)
        console.log('✅ 开发环境数据文件复制到 public 完成')
      }
    }
  } catch (error) {
    console.error('❌ 复制资源文件失败:', error)
    process.exit(1)
  }
}

copyAssets()