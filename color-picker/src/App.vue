<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import 'virtual:uno.css'
import { CheckCircle2, Droplet, Palette, RefreshCw } from 'lucide-vue-next'

// 颜色状态
const currentColor = ref('#3b82f6')
const colorHistory = ref<string[]>([])
const toast = reactive({ visible: false, message: '', kind: 'success' as 'success' | 'error' })

// 颜色格式
type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv'
const selectedFormat = ref<ColorFormat>('hex')

// 颜色转换函数
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  }
}

// 格式化颜色输出
const formatColor = (hex: string, format: ColorFormat): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  switch (format) {
    case 'hex':
      return hex.toUpperCase()
    case 'rgb':
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    case 'hsl': {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
    }
    case 'hsv': {
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
      return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`
    }
    default:
      return hex
  }
}

// 当前颜色的所有格式
const colorFormats = computed(() => {
  const rgb = hexToRgb(currentColor.value)
  if (!rgb) return []

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)

  return [
    { label: 'HEX', value: currentColor.value.toUpperCase(), format: 'hex' as ColorFormat },
    { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, format: 'rgb' as ColorFormat },
    {
      label: 'HSL',
      value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      format: 'hsl' as ColorFormat
    },
    {
      label: 'HSV',
      value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`,
      format: 'hsv' as ColorFormat
    }
  ]
})

// 显示提示
const showToast = (message: string, kind: 'success' | 'error' = 'success') => {
  toast.message = message
  toast.kind = kind
  toast.visible = true
  window.setTimeout(() => {
    toast.visible = false
  }, 2000)
}

// 复制颜色
const copyColor = async (value: string) => {
  try {
    if (window.unihub?.clipboard?.writeText) {
      await window.unihub.clipboard.writeText(value)
    } else {
      await navigator.clipboard.writeText(value)
    }
    showToast('复制成功', 'success')
  } catch {
    showToast('复制失败', 'error')
  }
}

// 使用 EyeDropper API 取色
const pickColor = async () => {
  try {
    // @ts-ignore - EyeDropper API
    if (!window.EyeDropper) {
      showToast('当前浏览器不支持取色功能', 'error')
      return
    }

    // @ts-ignore
    const eyeDropper = new EyeDropper()
    const result = await eyeDropper.open()

    if (result?.sRGBHex) {
      currentColor.value = result.sRGBHex
      addToHistory(result.sRGBHex)
      // 自动复制到剪贴板
      await copyColor(result.sRGBHex)
    }
  } catch (error) {
    // 用户取消取色
    if (error instanceof Error && error.name !== 'AbortError') {
      showToast('取色失败', 'error')
    }
  }
}

// 添加到历史记录
const addToHistory = async (color: string) => {
  // 移除重复的颜色
  colorHistory.value = colorHistory.value.filter((c) => c !== color)
  // 添加到开头
  colorHistory.value.unshift(color)
  // 限制历史记录数量为 6 个
  if (colorHistory.value.length > 6) {
    colorHistory.value = colorHistory.value.slice(0, 6)
  }
  // 保存到数据库
  await saveHistory()
}

// 从历史记录选择颜色
const selectFromHistory = (color: string) => {
  currentColor.value = color
}

// 清空历史记录
const clearHistory = async () => {
  colorHistory.value = []
  await saveHistory()
  showToast('已清空历史记录', 'success')
}

// 保存历史记录
const saveHistory = async () => {
  try {
    if (window.unihub?.db) {
      await window.unihub.db.set('colorHistory', colorHistory.value)
    }
  } catch (error) {
    console.error('保存历史记录失败:', error)
  }
}

// 加载历史记录
const loadHistory = async () => {
  try {
    if (window.unihub?.db) {
      const history = await window.unihub.db.get('colorHistory')
      if (Array.isArray(history)) {
        colorHistory.value = history.slice(0, 6) // 确保最多 6 个
      }
    }
  } catch (error) {
    console.error('加载历史记录失败:', error)
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="flex h-full w-full bg-background">
    <div class="flex h-full w-full flex-col gap-3 p-4">
      <!-- 顶部标题 -->
      <header class="flex items-center gap-2 text-base font-semibold text-foreground">
        <Palette class="h-5 w-5 text-primary" />
        取色器
      </header>

      <!-- 主要内容区 -->
      <main class="flex-1 overflow-y-auto pr-1">
        <div class="flex flex-col gap-3 pb-2">
          <!-- 取色按钮和颜色预览 -->
          <section class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div class="flex flex-col items-center gap-3">
              <!-- 颜色预览 -->
              <div class="flex flex-col items-center gap-2.5">
                <div
                  class="h-24 w-24 rounded-xl border-2 border-border shadow-md"
                  :style="{ backgroundColor: currentColor }"
                ></div>
                <div class="text-center">
                  <div class="text-lg font-bold text-foreground">
                    {{ currentColor.toUpperCase() }}
                  </div>
                  <div class="text-xs text-muted-foreground">当前颜色</div>
                </div>
              </div>

              <!-- 取色按钮 -->
              <button
                class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background shadow hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                @click="pickColor"
              >
                <Droplet class="h-4 w-4" />
                开始取色
              </button>

              <!-- 手动输入颜色 -->
              <div class="flex w-full items-center gap-2">
                <input
                  v-model="currentColor"
                  type="color"
                  class="h-9 w-14 cursor-pointer rounded-lg border border-border bg-card"
                  @change="addToHistory(currentColor)"
                />
                <input
                  v-model="currentColor"
                  type="text"
                  placeholder="#000000"
                  class="h-9 flex-1 rounded-lg border border-border bg-input px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  @blur="addToHistory(currentColor)"
                />
              </div>
            </div>
          </section>

          <!-- 颜色格式 -->
          <section class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div class="mb-3 text-sm font-semibold text-foreground">颜色格式</div>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="format in colorFormats"
                :key="format.format"
                class="inline-flex flex-col items-center justify-center gap-1 rounded-md border border-input bg-background px-2 py-3 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                @click="copyColor(format.value)"
              >
                <div class="text-xs font-semibold text-muted-foreground">
                  {{ format.label }}
                </div>
                <div class="w-full truncate font-mono text-xs font-medium text-foreground" :title="format.value">
                  {{ format.value }}
                </div>
              </button>
            </div>
          </section>

          <!-- 历史记录 -->
          <section class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between">
              <div class="text-sm font-semibold text-foreground">历史记录</div>
              <button
                v-if="colorHistory.length > 0"
                class="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                @click="clearHistory"
              >
                <RefreshCw class="h-3 w-3" />
                清空
              </button>
            </div>
            <div v-if="colorHistory.length === 0" class="py-6 text-center text-xs text-muted-foreground">
              暂无历史记录
            </div>
            <div v-else class="grid grid-cols-6 gap-2">
              <button
                v-for="(color, index) in colorHistory"
                :key="index"
                class="aspect-square rounded-md border border-input shadow-sm hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-transform"
                :style="{ backgroundColor: color }"
                :title="color"
                @click="selectFromHistory(color)"
              >
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>

    <!-- 复制提示气泡 -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="toast.visible"
        :class="[
          'absolute right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-lg bg-card',
          toast.kind === 'error'
            ? 'border-destructive/20 text-destructive'
            : 'border-primary/20 text-primary'
        ]"
      >
        <CheckCircle2 class="h-4 w-4" />
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>
