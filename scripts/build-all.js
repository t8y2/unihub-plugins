#!/usr/bin/env node

/**
 * 批量构建所有插件
 */

import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PLUGINS_DIR = join(__dirname, '..')

function getPluginDirs() {
  return readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => {
      const packageJsonPath = join(PLUGINS_DIR, name, 'package.json')
      return existsSync(packageJsonPath)
    })
}

function buildPlugin(pluginName) {
  const pluginDir = join(PLUGINS_DIR, pluginName)
  console.log(`\n📦 Building ${pluginName}...`)

  try {
    // 安装依赖
    console.log('  Installing dependencies...')
    execSync('pnpm install', { cwd: pluginDir, stdio: 'inherit' })

    // 构建
    console.log('  Building...')
    execSync('pnpm run build', { cwd: pluginDir, stdio: 'inherit' })

    console.log(`✅ ${pluginName} built successfully`)
    return true
  } catch (error) {
    console.error(`❌ Failed to build ${pluginName}:`, error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Building all plugins...\n')

  const plugins = getPluginDirs()
  console.log(`Found ${plugins.length} plugins: ${plugins.join(', ')}\n`)

  const results = plugins.map((plugin) => ({
    name: plugin,
    success: buildPlugin(plugin)
  }))

  console.log('\n📊 Build Summary:')
  console.log(`✅ Success: ${results.filter((r) => r.success).length}`)
  console.log(`❌ Failed: ${results.filter((r) => !r.success).length}`)

  const failed = results.filter((r) => !r.success)
  if (failed.length > 0) {
    console.log('\n❌ Failed plugins:')
    failed.forEach((r) => console.log(`  - ${r.name}`))
    process.exit(1)
  }

  console.log('\n🎉 All plugins built successfully!')
}

main()
