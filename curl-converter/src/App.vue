<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'curl-converter-output-format'

const input = ref('')
const outputFormat = ref<'single' | 'multiline'>('single')

// 从 localStorage 加载用户偏好
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'single' || saved === 'multiline') {
    outputFormat.value = saved
  }
})

// 监听格式变化并保存到 localStorage
watch(outputFormat, (newFormat) => {
  localStorage.setItem(STORAGE_KEY, newFormat)
})

/**
 * 将 Shell curl 命令转换为 Windows curl 格式
 * 主要处理：
 * 1. 单引号 → 双引号
 * 2. JSON 内部的双引号需要转义
 * 3. 行尾 \ 换行符处理
 */
const convertToWindowsCurl = (shellCurl: string): string => {
  if (!shellCurl.trim()) return ''

  // 1. 先处理换行：移除行尾的 \ 和换行符，合并成单行
  let merged = shellCurl
    .replace(/\\\s*\n\s*/g, ' ')  // 移除 \ 换行
    .replace(/\n\s*/g, ' ')        // 移除普通换行
    .replace(/\s+/g, ' ')          // 合并多余空格
    .trim()

  // 2. 解析并转换引号
  const result: string[] = []
  let i = 0

  while (i < merged.length) {
    const char = merged[i]

    if (char === "'") {
      // 找到单引号包裹的内容
      const endIndex = findMatchingQuote(merged, i, "'")
      if (endIndex === -1) {
        result.push(char)
        i++
        continue
      }

      const content = merged.slice(i + 1, endIndex)
      // 转义内部的双引号（包括已经转义的），然后用双引号包裹
      const escaped = content.replace(/\\"/g, '"').replace(/"/g, '\\"')
      result.push('"' + escaped + '"')
      i = endIndex + 1
    } else if (char === '"') {
      // 双引号内容保持不变
      const endIndex = findMatchingQuote(merged, i, '"')
      if (endIndex === -1) {
        result.push(char)
        i++
        continue
      }

      const content = merged.slice(i + 1, endIndex)
      // 双引号包裹的内容，内部双引号需要转义
      const escaped = content.replace(/\\"/g, '"').replace(/"/g, '\\"')
      result.push('"' + escaped + '"')
      i = endIndex + 1
    } else {
      result.push(char)
      i++
    }
  }

  return result.join('')
}

/**
 * 找到匹配的引号位置
 */
const findMatchingQuote = (str: string, start: number, quote: string): number => {
  for (let i = start + 1; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++ // 跳过转义字符
      continue
    }
    if (str[i] === quote) {
      return i
    }
  }
  return -1
}

/**
 * 格式化为多行（Windows 使用 ^ 作为换行符）
 */
const formatMultiline = (cmd: string): string => {
  // 在主要参数前换行
  const breakPoints = [' -H ', ' -X ', ' -d ', ' --data', ' --header', ' --request']
  let result = cmd

  for (const bp of breakPoints) {
    result = result.split(bp).join(' ^\n  ' + bp.trim() + ' ')
  }

  return result
}

const output = computed(() => {
  const converted = convertToWindowsCurl(input.value)
  if (!converted) return ''

  return outputFormat.value === 'multiline' ? formatMultiline(converted) : converted
})

const convert = (): void => {
  if (!input.value.trim()) {
    toast.warning('请输入 Shell curl 命令')
    return
  }
  toast.success('转换完成')
}

const copyToClipboard = async (): Promise<void> => {
  if (!output.value) {
    toast.warning('没有可复制的内容')
    return
  }
  try {
    await navigator.clipboard.writeText(output.value)
    toast.success('已复制到剪贴板')
  } catch {
    toast.error('复制失败')
  }
}

const clearAll = (): void => {
  input.value = ''
}

const pasteFromClipboard = async (): Promise<void> => {
  try {
    const text = await navigator.clipboard.readText()
    input.value = text
    toast.success('已粘贴')
  } catch {
    toast.error('无法读取剪贴板')
  }
}

// 示例命令
const exampleCurl = `curl --location --request POST 'https://xxx.com/test' \\
--header 'Content-Type: application/json' \\
--data-raw '{
    "arr": [
        "1"
    ],
    "total": 1
}'`

const loadExample = (): void => {
  input.value = exampleCurl
  toast.info('已加载示例')
}
</script>

<template>
  <Toaster position="top-center" :duration="3000" rich-colors />
  <div class="flex-1 flex flex-col min-h-0">
    <!-- 工具栏 -->
    <div
      class="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-2 flex-shrink-0"
    >
      <Button size="sm" @click="convert">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        转换
      </Button>

      <Button size="sm" variant="secondary" @click="pasteFromClipboard">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        粘贴
      </Button>

      <Button size="sm" variant="ghost" @click="clearAll">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        清空
      </Button>

      <Button size="sm" variant="outline" @click="loadExample">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        示例
      </Button>

      <div class="h-8 w-px bg-gray-300 mx-2"></div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-600 dark:text-gray-400">输出格式:</span>
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
          <Button
            size="sm"
            :variant="outputFormat === 'single' ? 'default' : 'ghost'"
            @click="outputFormat = 'single'"
          >
            单行
          </Button>
          <Button
            size="sm"
            :variant="outputFormat === 'multiline' ? 'default' : 'ghost'"
            @click="outputFormat = 'multiline'"
          >
            多行
          </Button>
        </div>
      </div>
    </div>

    <!-- 编辑器区域 -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- 输入区 -->
      <div class="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700 min-w-0">
        <div
          class="h-10 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 flex-shrink-0"
        >
          <span
            class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
          >
            Shell / Bash curl
          </span>
        </div>
        <div class="flex-1 overflow-auto min-h-0">
          <textarea
            v-model="input"
            placeholder="粘贴 Shell curl 命令...

示例:
curl -X POST 'https://api.example.com/users' \
  -H 'Content-Type: application/json' \
  -d '{&quot;name&quot;: &quot;John&quot;}'"
            class="w-full h-full p-4 bg-white dark:bg-gray-900 text-sm font-mono resize-none focus:outline-none dark:text-gray-100"
          />
        </div>
      </div>

      <!-- 输出区 -->
      <div class="flex-1 flex flex-col min-w-0">
        <div
          class="h-10 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 justify-between flex-shrink-0"
        >
          <span
            class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide"
          >
            Windows curl (CMD)
          </span>
          <Button
            v-if="output"
            size="sm"
            class="flex items-center gap-1.5"
            @click="copyToClipboard"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            复制
          </Button>
        </div>
        <div class="flex-1 overflow-auto bg-[#0d1117] min-h-0 scrollbar-hide">
          <pre
            v-if="output"
            class="p-4 text-sm text-green-400 font-mono whitespace-pre-wrap break-all"
          >{{ output }}</pre>
          <div v-else class="p-4 text-sm text-gray-500 font-mono">
            转换结果将显示在这里...
          </div>
        </div>
      </div>
    </div>

    <!-- 说明区 -->
    <div
      class="h-auto bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0"
    >
      <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p><strong>转换规则:</strong></p>
        <ul class="list-disc list-inside ml-2 space-y-0.5">
          <li>单引号 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">'</code> → 双引号 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">"</code></li>
          <li>JSON 内的双引号自动转义为 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">\"</code></li>
          <li>行尾 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">\</code> 换行符合并或转换为 <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">^</code></li>
        </ul>
      </div>
    </div>
  </div>
</template>
