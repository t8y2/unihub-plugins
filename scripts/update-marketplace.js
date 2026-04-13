#!/usr/bin/env node

/**
 * 更新 marketplace/plugins.json
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGINS_DIR = join(__dirname, "..");
const MARKETPLACE_FILE = join(__dirname, "../marketplace/plugins.json");
const BUCKET = process.env.COS_BUCKET || "unihub-1307847329";
const REGION = process.env.COS_REGION || "ap-shanghai";

function getPluginInfo(pluginName) {
  const packageJsonPath = join(PLUGINS_DIR, pluginName, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const unihub = packageJson.unihub || {};
  const version = unihub.version || packageJson.version;
  const downloadUrl = `https://${BUCKET}.cos.${REGION}.myqcloud.com/plugins/${pluginName}/${version}/plugin.zip`;

  const icon = unihub.icon && unihub.icon.startsWith("http") ? unihub.icon : "";

  return {
    id: unihub.id || pluginName,
    name: unihub.name || packageJson.displayName || packageJson.name,
    version,
    description: packageJson.description || "",
    author: packageJson.author || { name: "UniHub Team" },
    icon,
    category: unihub.category || "other",
    keywords: packageJson.keywords || [],
    permissions: unihub.permissions || [],
    install: {
      zip: downloadUrl,
    },
    downloadUrl,
    homepage: packageJson.homepage || "",
    repository: packageJson.repository?.url || "",
    screenshots: [],
    downloads: 0,
    rating: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function main() {
  console.log("📝 Updating marketplace/plugins.json...\n");

  const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .map(getPluginInfo)
    .filter(Boolean);

  const marketplace = {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    plugins,
  };

  writeFileSync(
    MARKETPLACE_FILE,
    JSON.stringify(marketplace, null, 2),
    "utf-8",
  );

  console.log(`✅ Updated marketplace with ${plugins.length} plugins`);
  console.log("\n📦 Plugins:");
  plugins.forEach((plugin) => {
    console.log(`  - ${plugin.name} (${plugin.version})`);
  });
}

main();
