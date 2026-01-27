#!/usr/bin/env node

/**
 * 批量打包所有插件为 plugin.zip
 */

import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PLUGINS_DIR = join(__dirname, '../plugins')

function getPluginDirs() {
  return readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => {
      const distDir = join(PLUGINS_DIR, name, 'dist')
      return existsSync(distDir)
    })
}

function packagePlugin(pluginName) {
  const pluginDir = join(PLUGINS_DIR, pluginName)
  const packageScript = join(pluginDir, 'scripts/package.js')

  console.log(`\n📦 Packaging ${pluginName}...`)

  try {
    if (existsSync(packageScript)) {
      execSync('node scripts/package.js', { cwd: pluginDir, stdio: 'inherit' })
    } else {
      // 使用默认打包逻辑
      const AdmZip = require('adm-zip')
      const zip = new AdmZip()
      zip.addLocalFolder(join(pluginDir, 'dist'))
      zip.writeZip(join(pluginDir, 'plugin.zip'))
    }

    console.log(`✅ ${pluginName} packaged successfully`)
    return true
  } catch (error) {
    console.error(`❌ Failed to package ${pluginName}:`, error.message)
    return false
  }
}

async function main() {
  console.log('📦 Packaging all plugins...\n')

  const plugins = getPluginDirs()
  console.log(`Found ${plugins.length} built plugins: ${plugins.join(', ')}\n`)

  const results = plugins.map((plugin) => ({
    name: plugin,
    success: packagePlugin(plugin)
  }))

  console.log('\n📊 Package Summary:')
  console.log(`✅ Success: ${results.filter((r) => r.success).length}`)
  console.log(`❌ Failed: ${results.filter((r) => !r.success).length}`)

  const failed = results.filter((r) => !r.success)
  if (failed.length > 0) {
    console.log('\n❌ Failed plugins:')
    failed.forEach((r) => console.log(`  - ${r.name}`))
    process.exit(1)
  }

  console.log('\n🎉 All plugins packaged successfully!')
}

main()
