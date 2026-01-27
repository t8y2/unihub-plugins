#!/usr/bin/env node

/**
 * 上传所有插件到腾讯云 COS
 */

import { readdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import COS from 'cos-nodejs-sdk-v5'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PLUGINS_DIR = join(__dirname, '../plugins')

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
})

const BUCKET = process.env.COS_BUCKET || 'unihub-1307847329'
const REGION = process.env.COS_REGION || 'ap-shanghai'

function getPluginsWithZip() {
  return readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => {
      const zipPath = join(PLUGINS_DIR, name, 'plugin.zip')
      return existsSync(zipPath)
    })
}

function uploadPlugin(pluginName) {
  return new Promise((resolve, reject) => {
    const zipPath = join(PLUGINS_DIR, pluginName, 'plugin.zip')
    const packageJsonPath = join(PLUGINS_DIR, pluginName, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    const key = `plugins/${pluginName}/${packageJson.version}/plugin.zip`

    console.log(`\n📤 Uploading ${pluginName} v${packageJson.version}...`)

    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: readFileSync(zipPath)
      },
      (err, data) => {
        if (err) {
          console.error(`❌ Failed to upload ${pluginName}:`, err.message)
          reject(err)
        } else {
          const url = `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`
          console.log(`✅ ${pluginName} uploaded: ${url}`)
          resolve({ pluginName, version: packageJson.version, url })
        }
      }
    )
  })
}

async function main() {
  console.log('📤 Uploading plugins to COS...\n')

  if (!process.env.COS_SECRET_ID || !process.env.COS_SECRET_KEY) {
    console.error('❌ COS credentials not found in environment variables')
    process.exit(1)
  }

  const plugins = getPluginsWithZip()
  console.log(`Found ${plugins.length} plugins to upload: ${plugins.join(', ')}\n`)

  try {
    const results = await Promise.all(plugins.map(uploadPlugin))

    console.log('\n📊 Upload Summary:')
    console.log(`✅ Success: ${results.length}`)

    console.log('\n🎉 All plugins uploaded successfully!')
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message)
    process.exit(1)
  }
}

main()
