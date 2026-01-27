#!/usr/bin/env node

/**
 * 上传插件到腾讯云 COS
 * 使用方法：
 *   node scripts/upload-to-cos.js <plugin-path>
 *   例如：node scripts/upload-to-cos.js examples/h5-formatter-plugin
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const { readFileSync, existsSync, statSync } = require('fs')
const { join, basename } = require('path')
const crypto = require('crypto')

// 手动加载 .env 文件
const envPath = join(__dirname, '../.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

// COS 配置
const COS_SECRET_ID = process.env.COS_SECRET_ID
const COS_SECRET_KEY = process.env.COS_SECRET_KEY
const COS_BUCKET = process.env.COS_BUCKET
const COS_REGION = process.env.COS_REGION
const COS_BASE_PATH = process.env.COS_BASE_PATH || 'official-plugins'

/**
 * 生成 COS 签名
 */
function getAuthorization(method, pathname, host, secretId, secretKey) {
  const now = Math.floor(Date.now() / 1000)
  const expired = now + 3600

  // 生成 KeyTime
  const keyTime = `${now};${expired}`

  // 生成 SignKey
  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest('hex')

  // 生成 HttpString
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`

  // 生成 StringToSign
  const sha1HttpString = crypto.createHash('sha1').update(httpString).digest('hex')
  const stringToSign = `sha1\n${keyTime}\n${sha1HttpString}\n`

  // 生成 Signature
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex')

  // 生成 Authorization
  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`
}

/**
 * 上传文件到 COS
 */
async function uploadToCOS(filePath, cosPath) {
  const fileContent = readFileSync(filePath)
  const fileSize = statSync(filePath).size

  const host = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`
  const pathname = `/${cosPath}`
  const url = `https://${host}${pathname}`

  const authorization = getAuthorization('PUT', pathname, host, COS_SECRET_ID, COS_SECRET_KEY)

  console.log(`📤 正在上传到 COS: ${cosPath}`)
  console.log(`   文件大小: ${(fileSize / 1024).toFixed(2)} KB`)
  console.log(`   目标地址: ${url}`)

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      Host: host,
      'Content-Type': 'application/zip',
      'Content-Length': fileSize.toString()
    },
    body: fileContent
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ COS 响应错误:')
    console.error(`   状态码: ${response.status}`)
    console.error(`   响应内容: ${error}`)
    throw new Error(`COS 上传失败 (${response.status}): ${error}`)
  }

  console.log(`✅ 上传成功 (${response.status})`)
  return url
}

/**
 * 主函数
 */
async function main() {
  // 检查环境变量
  if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
    console.error('❌ 错误：缺少 COS 配置')
    console.error('   请在 .env 文件中配置以下变量：')
    console.error('   - COS_SECRET_ID')
    console.error('   - COS_SECRET_KEY')
    console.error('   - COS_BUCKET')
    console.error('   - COS_REGION')
    console.error('   - COS_BASE_PATH (可选，默认为 "plugins")')
    console.error('')
    console.error('💡 提示：')
    console.error('   1. 访问 https://console.cloud.tencent.com/cam/capi 获取密钥')
    console.error('   2. 访问 https://console.cloud.tencent.com/cos 创建存储桶')
    console.error('   3. 确保存储桶权限为"公有读私有写"')
    process.exit(1)
  }

  // 显示配置信息（隐藏敏感信息）
  console.log('🔧 COS 配置：')
  console.log(`   Bucket: ${COS_BUCKET}`)
  console.log(`   Region: ${COS_REGION}`)
  console.log(`   Base Path: ${COS_BASE_PATH}`)
  console.log(`   Secret ID: ${COS_SECRET_ID.substring(0, 8)}...`)
  console.log('')

  // 获取插件路径
  const pluginPath = process.argv[2]
  if (!pluginPath) {
    console.error('❌ 错误：请指定插件路径')
    console.error('   使用方法：node scripts/upload-to-cos.js <plugin-path>')
    console.error('   例如：node scripts/upload-to-cos.js examples/h5-formatter-plugin')
    console.error('')
    console.error('   或使用 npm 命令：')
    console.error('   npm run upload:cos examples/h5-formatter-plugin')
    process.exit(1)
  }

  const pluginDir = join(__dirname, '..', pluginPath)
  if (!existsSync(pluginDir)) {
    console.error(`❌ 错误：插件目录不存在: ${pluginPath}`)
    process.exit(1)
  }

  // 检查 plugin.zip 是否存在
  const zipPath = join(pluginDir, 'plugin.zip')
  if (!existsSync(zipPath)) {
    console.error(`❌ 错误：未找到 plugin.zip`)
    console.error(`   请先运行打包命令：`)
    console.error(`   cd ${pluginPath} && npm run package`)
    process.exit(1)
  }

  // 读取 package.json 获取插件信息
  const packageJsonPath = join(pluginDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.error(`❌ 错误：未找到 package.json`)
    process.exit(1)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  const pluginId = packageJson.unihub?.id || packageJson.name
  const pluginVersion = packageJson.unihub?.version || packageJson.version

  console.log('📦 插件信息：')
  console.log(`   ID: ${pluginId}`)
  console.log(`   版本: ${pluginVersion}`)
  console.log(`   路径: ${pluginPath}`)
  console.log('')

  try {
    // 构建 COS 路径
    const pluginName = basename(pluginPath)

    // 上传到两个位置：
    // 1. 最新版本（无版本号）- 用于快速访问
    const latestPath = `${COS_BASE_PATH}/${pluginName}/plugin.zip`
    // 2. 版本化路径 - 用于版本管理和回滚
    const versionedPath = `${COS_BASE_PATH}/${pluginName}/v${pluginVersion}/plugin.zip`

    console.log('📤 上传策略：')
    console.log(`   1. 最新版本: ${latestPath}`)
    console.log(`   2. 版本存档: ${versionedPath}`)
    console.log('')

    // 上传最新版本
    console.log('正在上传最新版本...')
    const latestUrl = await uploadToCOS(zipPath, latestPath)

    // 上传版本化文件
    console.log('')
    console.log('正在上传版本存档...')
    const versionedUrl = await uploadToCOS(zipPath, versionedPath)

    console.log('')
    console.log('✅ 上传成功！')
    console.log('')
    console.log('📋 下载链接：')
    console.log(`   最新版本: ${latestUrl}`)
    console.log(`   版本存档: ${versionedUrl}`)
    console.log('')
    console.log('📝 请将以下配置添加到 marketplace/plugins.json：')
    console.log('')
    console.log(
      JSON.stringify(
        {
          install: {
            zip: latestUrl
          }
        },
        null,
        2
      )
    )
    console.log('')
    console.log('💡 提示：')
    console.log('   - 用户将下载最新版本')
    console.log(`   - 版本 ${pluginVersion} 已存档，可用于回滚`)
    console.log('   - 你可以在浏览器中访问上面的链接测试下载')
  } catch (error) {
    console.error('')
    console.error('❌ 上传失败:', error.message)
    console.error('')
    console.error('🔍 排查建议：')
    console.error('   1. 检查 COS_SECRET_ID 和 COS_SECRET_KEY 是否正确')
    console.error('   2. 检查存储桶名称和地域是否正确')
    console.error('   3. 确认密钥有存储桶的写入权限')
    console.error('   4. 确认存储桶权限为"公有读私有写"')
    console.error('   5. 检查网络连接是否正常')
    process.exit(1)
  }
}

main()
