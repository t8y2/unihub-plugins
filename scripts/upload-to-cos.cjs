#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const COS = require("cos-nodejs-sdk-v5");
const { readFileSync, existsSync, statSync } = require("fs");
const { join } = require("path");

// 手动加载 .env 文件
const envPath = join(__dirname, "../.env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const COS_SECRET_ID = process.env.COS_SECRET_ID;
const COS_SECRET_KEY = process.env.COS_SECRET_KEY;
const COS_BUCKET = process.env.COS_BUCKET;
const COS_REGION = process.env.COS_REGION;
const COS_BASE_PATH = process.env.COS_BASE_PATH || "official-plugins";

if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
  console.error(
    "❌ 错误：缺少 COS 配置 (COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION)",
  );
  process.exit(1);
}

const cos = new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY });

function uploadFile(localPath, key) {
  return new Promise((resolve, reject) => {
    cos.uploadFile(
      {
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: key,
        FilePath: localPath,
        SliceSize: 5 * 1024 * 1024, // >5MB 自动切片上传
      },
      (err, data) => {
        if (err) reject(err);
        else resolve(data);
      },
    );
  });
}

async function main() {
  const pluginPath = process.argv[2];
  if (!pluginPath) {
    console.error("Usage: node scripts/upload-to-cos.cjs <plugin-name>");
    process.exit(1);
  }

  const pluginDir = join(__dirname, "..", pluginPath);
  const zipPath = join(pluginDir, "plugin.zip");
  const pkgPath = join(pluginDir, "package.json");

  if (!existsSync(zipPath)) {
    console.error(`❌ plugin.zip not found in ${pluginPath}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const pluginVersion = pkg.unihub?.version || pkg.version;
  const fileSize = statSync(zipPath).size;

  const latestKey = `${COS_BASE_PATH}/${pluginPath}/plugin.zip`;
  const versionedKey = `${COS_BASE_PATH}/${pluginPath}/v${pluginVersion}/plugin.zip`;

  console.log(
    `📤 上传 ${pluginPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
  );
  console.log(`   最新版本: ${latestKey}`);
  console.log(`   版本存档: ${versionedKey}`);

  await uploadFile(zipPath, latestKey);
  console.log("✅ 最新版本上传成功");

  await uploadFile(zipPath, versionedKey);
  console.log("✅ 版本存档上传成功");
}

main().catch((e) => {
  console.error("❌ 上传失败:", e.message);
  console.error("🔍 排查建议：");
  console.error("   1. 检查 COS_SECRET_ID 和 COS_SECRET_KEY 是否正确");
  console.error("   2. 检查存储桶名称和地域是否正确");
  console.error("   3. 确认密钥有存储桶的写入权限");
  process.exit(1);
});

