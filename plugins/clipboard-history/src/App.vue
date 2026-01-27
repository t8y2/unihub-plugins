<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useClipboardDB } from '@/composables/useClipboardDB'
import type { ClipboardItem } from '@/composables/useClipboardDB'
import {
  Clipboard,
  Copy,
  Trash2,
  Search,
  X,
  Clock,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Pin,
  Bookmark,
  BookmarkCheck,
  RefreshCw
} from 'lucide-vue-next'

const {
  items,
  favorites,
  isLoading,
  addItem: addItemToDB,
  deleteItem: deleteItemFromDB,
  clearUnpinned,
  toggleFavorite,
  removeFavorite
} = useClipboardDB()

const searchQuery = ref('')
const selectedType = ref<'all' | 'text' | 'url' | 'code' | 'image'>('all')
const showPinnedOnly = ref(false)
// 悬浮中转窗口通过 URL 参数区分
const isFloatingMode = ref(new URLSearchParams(window.location.search).get('floating') === '1')
// 记录勾选的条目，用于悬浮中转
const selectedIds = ref(new Set<string>())
// 悬浮中转窗口展示的数据
const floatingItems = ref<ClipboardItem[]>([])
// 记录最近一次文本/图片，避免重复入库
const lastClipboardText = ref('')
const lastClipboardImage = ref('')
const isRefreshing = ref(false)
const isPasting = ref(false)
let clipboardPollTimer: number | null = null
let clipboardUnsubscribe: (() => void) | null = null
let floatingItemsListener: ((event: unknown) => void) | null = null

const uiText = {
  title: '剪贴板历史',
  all: '全部',
  favorites: '收藏',
  text: '文本',
  link: '链接',
  code: '代码',
  image: '图片',
  clearHistory: '清空历史记录',
  refresh: '刷新',
  refreshTitle: '检查剪贴板',
  searchPlaceholder: '搜索剪贴板内容...',
  emptySearch: '没有找到匹配的内容',
  emptyHistory: '暂无剪贴板历史',
  loading: '加载中...',
  copied: '复制',
  remove: '删除',
  cancelFavorite: '取消收藏',
  addFavorite: '收藏',
  justNow: '刚刚',
  minutesAgo: '分钟前',
  hoursAgo: '小时前',
  daysAgo: '天前',
  confirmClear: '确定要清空所有历史记录吗？（收藏的项目将保留）',
  charCount: '字符',
  floatingTransfer: '悬浮中转',
  floatingTitle: '悬浮中转',
  selectedLabel: '已选',
  itemUnit: '项',
  selectAllVisible: '全选当前',
  clearSelection: '清空选择',
  close: '关闭',
  emptyFloating: '暂无悬浮内容'
}

const favoriteIds = computed(() => new Set(favorites.value.map((item) => item.id)))
const selectedCount = computed(() => selectedIds.value.size)
const allItemsById = computed(() => {
  const map = new Map<string, ClipboardItem>()
  for (const item of favorites.value) {
    map.set(item.id, item)
  }
  for (const item of items.value) {
    map.set(item.id, item)
  }
  return map
})
const selectedItems = computed(() => {
  const map = allItemsById.value
  return Array.from(selectedIds.value)
    .map((id) => map.get(id))
    .filter((item): item is ClipboardItem => Boolean(item))
})
const floatingItemsSorted = computed(() =>
  [...floatingItems.value].sort((a, b) => b.timestamp - a.timestamp)
)

const filteredItems = computed(() => {
  let filtered = showPinnedOnly.value ? favorites.value : items.value

  if (selectedType.value !== 'all') {
    filtered = filtered.filter((item) => item.type === selectedType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    const imageKeywords = ['image', 'img', uiText.image]
    filtered = filtered.filter((item) => {
      if (item.type === 'image') {
        return imageKeywords.some((keyword) => keyword.toLowerCase().includes(query))
      }
      return item.content.toLowerCase().includes(query)
    })
  }

  return [...filtered].sort((a, b) => b.timestamp - a.timestamp)
})

const stats = computed(() => {
  return {
    total: items.value.length,
    pinned: favorites.value.length,
    text: items.value.filter((i) => i.type === 'text').length,
    url: items.value.filter((i) => i.type === 'url').length,
    code: items.value.filter((i) => i.type === 'code').length,
    image: items.value.filter((i) => i.type === 'image').length
  }
})

const viewTitle = computed(() => {
  if (showPinnedOnly.value) return uiText.favorites
  if (selectedType.value === 'all') return uiText.all
  if (selectedType.value === 'text') return uiText.text
  if (selectedType.value === 'url') return uiText.link
  if (selectedType.value === 'image') return uiText.image
  return uiText.code
})

// 悬浮中转的存储键
const FLOATING_STORAGE_KEY = 'floating-items'

const isImageDataUrl = (content: string): boolean => content.startsWith('data:image/')

const detectType = (content: string): ClipboardItem['type'] => {
  const urlPattern = /^https?:\/\/.+/i
  const codePattern = /^(function|const|let|var|class|import|export|<\?php|def |public |private )/

  if (isImageDataUrl(content)) return 'image'
  if (urlPattern.test(content.trim())) return 'url'
  if (codePattern.test(content.trim()) || content.includes('```')) return 'code'
  return 'text'
}

const addItem = async (content: string, typeOverride?: ClipboardItem['type']) => {
  const newItem: ClipboardItem = {
    id: Date.now().toString(),
    content,
    type: typeOverride ?? detectType(content),
    timestamp: Date.now()
  }

  await addItemToDB(newItem)
}

// 读取剪贴板：优先图片，避免被文本覆盖
const syncClipboard = async () => {
  try {
    const image = await window.unihub.clipboard.readImage()
    if (image && image.trim().length > 0) {
      if (image === lastClipboardImage.value) return
      lastClipboardImage.value = image
      lastClipboardText.value = ''
      await addItem(image, 'image')
      return
    }

    const text = await window.unihub.clipboard.readText()
    if (!text || text.trim().length === 0) return
    if (text === lastClipboardText.value) return
    lastClipboardText.value = text
    lastClipboardImage.value = ''
    await addItem(text)
  } catch (error) {
    console.error('clipboard read failed', error)
  }
}

// 根据类型写入剪贴板（图片/文本分流）
const copyToClipboard = async (item: ClipboardItem) => {
  try {
    if (item.type === 'image') {
      await window.unihub.clipboard.writeImage(item.content)
      lastClipboardImage.value = item.content
      return
    }

    await window.unihub.clipboard.writeText(item.content)
    lastClipboardText.value = item.content
    lastClipboardImage.value = ''
  } catch (err) {
    console.error('copy failed', err)
  }
}

// 简易延迟，用于节流避免连续触发
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 双击触发：切回上一个窗口并自动粘贴
const pasteToLastActiveWindow = async (item: ClipboardItem) => {
  if (!item.content || isPasting.value) return
  isPasting.value = true
  try {
    await copyToClipboard(item)
    // 悬浮窗口保持显示，只切换前台并粘贴
    // 悬浮窗切换更快，缩短等待时间
    const delayMs = isFloatingMode.value ? 160 : 260
    await window.unihub.system.quickPaste({
      delayMs,
      hideWindow: !isFloatingMode.value
    })
  } catch (err) {
    console.error('paste failed', err)
  } finally {
    // 冷却一下，避免重复双击
    await wait(240)
    isPasting.value = false
  }
}

const toggleFavoriteItem = async (item: ClipboardItem) => {
  await toggleFavorite(item)
}

const handleDelete = async (item: ClipboardItem) => {
  removeSelection(item.id)
  if (showPinnedOnly.value) {
    await removeFavorite(item.id)
    return
  }

  await deleteItemFromDB(item.id)
}

const clearAll = async () => {
  if (confirm(uiText.confirmClear)) {
    await clearUnpinned()
    clearSelection()
  }
}

const manualRefresh = async () => {
  isRefreshing.value = true
  await syncClipboard()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return uiText.justNow
  if (minutes < 60) return `${minutes}${uiText.minutesAgo}`
  if (hours < 24) return `${hours}${uiText.hoursAgo}`
  if (days < 7) return `${days}${uiText.daysAgo}`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const truncateText = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const getTypeIcon = (type: ClipboardItem['type']) => {
  switch (type) {
    case 'url':
      return LinkIcon
    case 'code':
      return Code
    case 'image':
      return ImageIcon
    default:
      return FileText
  }
}

const getTypeLabel = (type: ClipboardItem['type']) => {
  switch (type) {
    case 'url':
      return uiText.link
    case 'code':
      return uiText.code
    case 'image':
      return uiText.image
    default:
      return uiText.text
  }
}

const handlePaste = async (e: ClipboardEvent) => {
  const pasteItems = e.clipboardData?.items ?? []
  for (const item of pasteItems) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        if (!result) return
        lastClipboardImage.value = result
        lastClipboardText.value = ''
        void addItem(result, 'image')
      }
      reader.readAsDataURL(file)
      return
    }
  }

  const text = e.clipboardData?.getData('text')
  if (text && text.trim().length > 0) {
    lastClipboardText.value = text
    lastClipboardImage.value = ''
    addItem(text)
  }
}

const startClipboardWatcher = async () => {
  await syncClipboard()

  try {
    await window.unihub.clipboard.subscribe()
    clipboardUnsubscribe = window.unihub.clipboard.onChange((data) => {
      if (!data.content) return
      if (isImageDataUrl(data.content)) {
        if (data.content === lastClipboardImage.value) return
        lastClipboardImage.value = data.content
        lastClipboardText.value = ''
        addItem(data.content, 'image')
        return
      }

      if (data.content !== lastClipboardText.value) {
        lastClipboardText.value = data.content
        lastClipboardImage.value = ''
        addItem(data.content)
      }
    })
  } catch (error) {
    console.error('clipboard subscribe failed', error)
  }

  if (clipboardPollTimer === null) {
    clipboardPollTimer = window.setInterval(() => {
      void syncClipboard()
    }, 1000)
  }
}

const stopClipboardWatcher = () => {
  if (clipboardUnsubscribe) {
    clipboardUnsubscribe()
    clipboardUnsubscribe = null
  }

  if (clipboardPollTimer !== null) {
    window.clearInterval(clipboardPollTimer)
    clipboardPollTimer = null
  }

  void window.unihub.clipboard.unsubscribe().catch((error) => {
    console.error('clipboard unsubscribe failed', error)
  })
}

const getPluginId = (): string => {
  const params = new URLSearchParams(window.location.search)
  const queryId = params.get('__plugin_id')
  if (queryId) return queryId
  const windowId = (window as Window & { __UNIHUB_PLUGIN_ID__?: string }).__UNIHUB_PLUGIN_ID__
  if (windowId) return windowId
  return 'com.unihub.clipboard-history'
}

const loadFloatingItems = async () => {
  if (!window.unihub?.db) return
  const stored = await window.unihub.db.get(FLOATING_STORAGE_KEY)
  floatingItems.value = Array.isArray(stored) ? (stored as ClipboardItem[]) : []
}

const saveFloatingItems = async (itemsToSave: ClipboardItem[]) => {
  if (!window.unihub?.db) return
  await window.unihub.db.set(FLOATING_STORAGE_KEY, itemsToSave)
}

const clearFloatingItems = async () => {
  if (!window.unihub?.db) return
  await window.unihub.db.delete(FLOATING_STORAGE_KEY)
}

const toggleSelection = (item: ClipboardItem) => {
  const next = new Set(selectedIds.value)
  if (next.has(item.id)) {
    next.delete(item.id)
  } else {
    next.add(item.id)
  }
  selectedIds.value = next
}

const clearSelection = () => {
  selectedIds.value = new Set()
}

const selectAllVisible = () => {
  const next = new Set(selectedIds.value)
  for (const item of filteredItems.value) {
    next.add(item.id)
  }
  selectedIds.value = next
}

const removeSelection = (itemId: string) => {
  if (!selectedIds.value.has(itemId)) return
  const next = new Set(selectedIds.value)
  next.delete(itemId)
  selectedIds.value = next
}

// 将选中项写入存储并打开悬浮窗口
const openFloatingTransfer = async () => {
  if (selectedItems.value.length === 0) return
  const itemsToSave = selectedItems.value.map((item) => ({ ...item }))
  await saveFloatingItems(itemsToSave)
  window.electron?.ipcRenderer.send('clipboard-floating:open', { pluginId: getPluginId() })
  clearSelection()
  window.electron?.ipcRenderer.send('close-window')
}

// 关闭悬浮窗口并清理中转数据
const closeFloatingWindow = async () => {
  await clearFloatingItems()
  floatingItems.value = []
  window.electron?.ipcRenderer.send('clipboard-floating:close')
}

const removeFloatingItem = async (itemId: string) => {
  floatingItems.value = floatingItems.value.filter((item) => item.id !== itemId)
  await saveFloatingItems(floatingItems.value)
}

onMounted(async () => {
  if (isFloatingMode.value) {
    // 悬浮模式只加载中转数据，不启用剪贴板监听
    await loadFloatingItems()
    if (window.electron?.ipcRenderer) {
      floatingItemsListener = () => {
        void loadFloatingItems()
      }
      window.electron.ipcRenderer.on('clipboard-floating:items-updated', floatingItemsListener)
    }
    return
  }

  await startClipboardWatcher()
  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  if (isFloatingMode.value) {
    if (floatingItemsListener && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.removeListener(
        'clipboard-floating:items-updated',
        floatingItemsListener
      )
    }
    return
  }

  stopClipboardWatcher()
  window.removeEventListener('paste', handlePaste)
})
</script>

<template>
  <div v-if="!isFloatingMode" class="flex h-full bg-background">
    <div class="w-52 bg-card border-r border-border flex flex-col flex-shrink-0">
      <div class="h-14 px-4 border-b border-border flex items-center flex-shrink-0">
        <h1 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clipboard :size="20" class="text-primary" />
          {{ uiText.title }}
        </h1>
      </div>

      <div class="flex-1 overflow-y-auto p-3">
        <div class="space-y-0.5">
          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              selectedType === 'all' && !showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="selectedType = 'all'; showPinnedOnly = false"
          >
            <Clock :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.all }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.total }}</span>
          </button>

          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="showPinnedOnly = !showPinnedOnly; selectedType = 'all'"
          >
            <Bookmark :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.favorites }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.pinned }}</span>
          </button>

          <div class="h-px bg-border my-2"></div>

          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              selectedType === 'text' && !showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="selectedType = 'text'; showPinnedOnly = false"
          >
            <FileText :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.text }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.text }}</span>
          </button>

          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              selectedType === 'url' && !showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="selectedType = 'url'; showPinnedOnly = false"
          >
            <LinkIcon :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.link }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.url }}</span>
          </button>

          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              selectedType === 'code' && !showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="selectedType = 'code'; showPinnedOnly = false"
          >
            <Code :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.code }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.code }}</span>
          </button>

          <button
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
              selectedType === 'image' && !showPinnedOnly
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground'
            ]"
            @click="selectedType = 'image'; showPinnedOnly = false"
          >
            <ImageIcon :size="16" />
            <span class="flex-1 text-left font-medium">{{ uiText.image }}</span>
            <span class="text-xs font-semibold tabular-nums">{{ stats.image }}</span>
          </button>
        </div>
      </div>

      <div class="p-3 border-t border-border">
        <button
          class="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          @click="clearAll"
        >
          {{ uiText.clearHistory }}
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-w-0">
      <div class="h-14 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <h2 class="text-base font-semibold text-foreground">{{ viewTitle }}</h2>

        <div class="flex-1"></div>

        <button
          class="h-8 px-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          :disabled="isRefreshing"
          @click="manualRefresh"
          :title="uiText.refreshTitle"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': isRefreshing }" />
          {{ uiText.refresh }}
        </button>

        <button
          class="h-8 px-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
          :disabled="selectedCount === 0"
          @click="openFloatingTransfer"
          :title="uiText.floatingTransfer"
        >
          <Pin :size="14" />
          {{ uiText.floatingTransfer }}
          <span
            v-if="selectedCount"
            class="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
          >
            {{ selectedCount }}
          </span>
        </button>

        <div class="relative w-64">
          <Search
            :size="14"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="uiText.searchPlaceholder"
            class="w-full h-8 pl-8 pr-8 bg-input border-0 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            @click="searchQuery = ''"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div
          v-if="selectedCount > 0"
          class="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
        >
          <span>{{ uiText.selectedLabel }} {{ selectedCount }} {{ uiText.itemUnit }}</span>
          <div class="flex-1"></div>
          <button
            class="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
            @click="selectAllVisible"
          >
            {{ uiText.selectAllVisible }}
          </button>
          <button
            class="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
            @click="clearSelection"
          >
            {{ uiText.clearSelection }}
          </button>
        </div>

        <div v-if="isLoading" class="text-center py-12">
          <RefreshCw :size="48" class="mx-auto text-muted-foreground/30 mb-3 animate-spin" />
          <p class="text-sm text-muted-foreground">{{ uiText.loading }}</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="text-center py-12">
          <Clipboard :size="48" class="mx-auto text-muted-foreground/30 mb-3" />
          <p class="text-sm text-muted-foreground">
            {{ searchQuery ? uiText.emptySearch : uiText.emptyHistory }}
          </p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            :class="[
              'group bg-card border border-border rounded-lg p-3 transition-all duration-200 hover:shadow-sm hover:border-primary/50',
              selectedIds.has(item.id) ? 'border-primary/60 bg-primary/5' : ''
            ]"
          >
            <div class="flex items-start gap-3">
              <label class="mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
                  :checked="selectedIds.has(item.id)"
                  @change="toggleSelection(item)"
                  @click.stop
                />
              </label>

              <component
                :is="getTypeIcon(item.type)"
                :size="16"
                class="flex-shrink-0 mt-0.5 text-muted-foreground"
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-2 mb-1 min-w-0">
                  <div
                    v-if="item.type === 'image'"
                    class="flex-1"
                    @dblclick.stop="pasteToLastActiveWindow(item)"
                  >
                    <img
                      :src="item.content"
                      :alt="getTypeLabel(item.type)"
                      class="max-h-40 w-auto rounded-md border border-border object-contain"
                    />
                  </div>

                  <pre
                    v-else
                    class="flex-1 min-w-0 text-sm text-foreground font-mono whitespace-pre-wrap break-all"
                    @dblclick.stop="pasteToLastActiveWindow(item)"
                  >{{ truncateText(item.content) }}</pre>

                  <div class="flex-shrink-0 flex items-center gap-1 relative z-10">
                    <button
                      :class="[
                        'p-1.5 rounded-md transition-colors',
                        favoriteIds.has(item.id)
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100'
                      ]"
                      :title="favoriteIds.has(item.id) ? uiText.cancelFavorite : uiText.addFavorite"
                      @click="toggleFavoriteItem(item)"
                    >
                      <component :is="favoriteIds.has(item.id) ? BookmarkCheck : Bookmark" :size="14" />
                    </button>

                    <button
                      class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      :title="uiText.copied"
                      @click="copyToClipboard(item)"
                    >
                      <Copy :size="14" />
                    </button>

                    <button
                      class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      :title="uiText.remove"
                      @click="handleDelete(item)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock :size="12" />
                  <span>{{ formatTime(item.timestamp) }}</span>
                  <span class="text-muted-foreground/50">|</span>
                  <span>{{ getTypeLabel(item.type) }}</span>
                  <span v-if="item.type !== 'image'" class="text-muted-foreground/50">|</span>
                  <span v-if="item.type !== 'image'">{{ item.content.length }} {{ uiText.charCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex h-full bg-background">
    <div class="flex-1 flex flex-col min-w-0">
      <div class="h-10 bg-card border-b border-border flex items-center px-3 gap-2 drag-area">
        <Pin :size="14" class="text-primary" />
        <span class="text-sm font-semibold text-foreground">{{ uiText.floatingTitle }}</span>
        <span class="text-xs text-muted-foreground">{{ floatingItemsSorted.length }} {{ uiText.itemUnit }}</span>
        <div class="flex-1"></div>
        <button
          class="no-drag rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          :title="uiText.close"
          @click="closeFloatingWindow"
        >
          <X :size="14" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-3">
        <div v-if="floatingItemsSorted.length === 0" class="text-center py-10">
          <Clipboard :size="32" class="mx-auto text-muted-foreground/30 mb-2" />
          <p class="text-xs text-muted-foreground">{{ uiText.emptyFloating }}</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="item in floatingItemsSorted"
            :key="item.id"
            class="group bg-card border border-border rounded-lg p-2.5 transition-all duration-200 hover:shadow-sm hover:border-primary/50"
          >
            <div class="flex items-start gap-2">
              <component
                :is="getTypeIcon(item.type)"
                :size="14"
                class="flex-shrink-0 mt-0.5 text-muted-foreground"
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-2 mb-1 min-w-0">
                  <div
                    v-if="item.type === 'image'"
                    class="flex-1"
                    @dblclick.stop="pasteToLastActiveWindow(item)"
                  >
                    <img
                      :src="item.content"
                      :alt="getTypeLabel(item.type)"
                      class="max-h-28 w-auto rounded-md border border-border object-contain"
                    />
                  </div>

                  <pre
                    v-else
                    class="flex-1 min-w-0 text-xs text-foreground font-mono whitespace-pre-wrap break-all"
                    @dblclick.stop="pasteToLastActiveWindow(item)"
                  >{{ truncateText(item.content, 120) }}</pre>

                  <div class="flex-shrink-0 flex items-center gap-1 no-drag relative z-10">
                    <button
                      class="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      :title="uiText.copied"
                      @click="copyToClipboard(item)"
                    >
                      <Copy :size="12" />
                    </button>

                    <button
                      class="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      :title="uiText.remove"
                      @click="removeFloatingItem(item.id)"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock :size="10" />
                  <span>{{ formatTime(item.timestamp) }}</span>
                  <span class="text-muted-foreground/50">|</span>
                  <span>{{ getTypeLabel(item.type) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
