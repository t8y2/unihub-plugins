<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePasswordDB, type PasswordEntry } from './composables/usePasswordDB'
import { useToast } from './composables/useToast'
import SetupView from './components/SetupView.vue'
import UnlockView from './components/UnlockView.vue'
import PasswordList from './components/PasswordList.vue'
import PasswordForm from './components/PasswordForm.vue'
import PasswordGenerator from './components/PasswordGenerator.vue'

const { toast } = useToast()

// 主题监听
onMounted(() => {
  // 监听 UniHub 的主题变化通知
  const handleThemeChange = (...args: unknown[]) => {
    const theme = args[1] as 'light' | 'dark'
    console.log('[密码管理器] 收到主题变化通知:', theme)
    document.body.classList.toggle('dark', theme === 'dark')
  }
  
  // 使用 electron ipcRenderer 监听
  if (window.electron?.ipcRenderer) {
    window.electron.ipcRenderer.on('theme-changed', handleThemeChange)
    
    onUnmounted(() => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('theme-changed', handleThemeChange)
      }
    })
  }
  
  // 初始化时也检测一次系统主题作为后备
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.body.classList.toggle('dark', isDark)
})

const {
  entries,
  isLoading,
  isUnlocked,
  hasSetup,
  setupMasterPassword,
  unlock,
  lock,
  addEntry,
  updateEntry,
  deleteEntry,
  toggleFavorite
} = usePasswordDB()

const searchQuery = ref('')
const selectedCategory = ref('all')
const activeTab = ref<'all' | 'favorites'>('all')
const showForm = ref(false)
const showGenerator = ref(false)
const editingEntry = ref<PasswordEntry | null>(null)

const categories = computed(() => {
  const cats = new Set(entries.value.map((e) => e.category))
  return ['all', ...Array.from(cats)]
})

const filteredEntries = computed(() => {
  // 根据 tab 过滤
  let result = activeTab.value === 'favorites' 
    ? entries.value.filter((e) => e.isFavorite)
    : entries.value

  if (selectedCategory.value !== 'all') {
    result = result.filter((e) => e.category === selectedCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.username.toLowerCase().includes(query) ||
        e.url?.toLowerCase().includes(query)
    )
  }

  return result
})

const favoriteEntries = computed(() => entries.value.filter((e) => e.isFavorite))

const handleSetup = async (password: string) => {
  await setupMasterPassword(password)
}

const handleUnlock = async (password: string, callback: (success: boolean) => void) => {
  const success = await unlock(password)
  callback(success)
}

const handleAddEntry = () => {
  editingEntry.value = null
  showForm.value = true
}

const handleEditEntry = (entry: PasswordEntry) => {
  editingEntry.value = entry
  showForm.value = true
}

const handleSaveEntry = async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
  if (editingEntry.value) {
    await updateEntry({ ...editingEntry.value, ...entry })
  } else {
    await addEntry(entry)
  }
  showForm.value = false
  editingEntry.value = null
  generatedPassword.value = ''
}

const handleCancelForm = () => {
  showForm.value = false
  editingEntry.value = null
  generatedPassword.value = ''
}

const generatedPassword = ref('')

const handleUseGeneratedPassword = (password: string) => {
  generatedPassword.value = password
  showGenerator.value = false
  showForm.value = true
}
</script>

<template>
  <div class="h-full bg-background text-foreground">
    <div v-if="isLoading" class="flex h-full items-center justify-center">
      <div class="text-muted-foreground">加载中...</div>
    </div>

    <SetupView v-else-if="!hasSetup" @setup="handleSetup" />

    <UnlockView v-else-if="!isUnlocked" @unlock="handleUnlock" />

    <div v-else class="flex h-full flex-col">
      <!-- 头部 -->
      <div class="border-b border-border bg-card px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold">密码管理器</h1>
          <div class="flex items-center gap-2">
            <button
              @click="showGenerator = true"
              class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              密码生成器
            </button>
            <button
              @click="handleAddEntry"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              添加密码
            </button>
            <button
              @click="lock"
              class="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              锁定
            </button>
          </div>
        </div>

        <!-- 搜索和筛选 -->
        <div class="mt-4 flex gap-4">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索密码..."
            class="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            v-model="selectedCategory"
            class="rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">所有分类</option>
            <option v-for="cat in categories.filter((c) => c !== 'all')" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>

        <!-- Tab 切换 -->
        <div class="mt-4 inline-flex gap-1 rounded-lg bg-muted p-1">
          <button
            @click="activeTab = 'all'"
            :class="[
              'relative px-4 py-2 text-sm font-medium transition-all rounded-md',
              activeTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            所有密码
          </button>
          <button
            @click="activeTab = 'favorites'"
            :class="[
              'relative px-4 py-2 text-sm font-medium transition-all rounded-md flex items-center gap-1.5',
              activeTab === 'favorites'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            收藏夹
            <span v-if="favoriteEntries.length > 0" class="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary font-semibold">
              {{ favoriteEntries.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-auto p-6">
        <PasswordList
          v-if="filteredEntries.length > 0"
          :entries="filteredEntries"
          @edit="handleEditEntry"
          @delete="deleteEntry"
          @toggle-favorite="toggleFavorite"
        />
        <div v-else class="flex flex-col items-center justify-center py-16 text-center">
          <svg class="h-16 w-16 text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="activeTab === 'favorites'" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p class="text-muted-foreground">
            {{ searchQuery ? '未找到匹配的密码' : activeTab === 'favorites' ? '暂无收藏，点击密码卡片上的星标添加收藏' : '暂无密码，点击"添加密码"开始使用' }}
          </p>
        </div>
      </div>
    </div>

    <!-- 表单弹窗 -->
    <PasswordForm
      v-if="showForm"
      :entry="editingEntry"
      :generated-password="generatedPassword"
      @save="handleSaveEntry"
      @cancel="handleCancelForm"
    />

    <!-- 密码生成器弹窗 -->
    <PasswordGenerator
      v-if="showGenerator"
      @use="handleUseGeneratedPassword"
      @close="showGenerator = false"
    />

    <!-- Toast 提示 -->
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
          'fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg bg-card',
          toast.type === 'error'
            ? 'border-destructive/20 text-destructive'
            : toast.type === 'success'
            ? 'border-primary/20 text-primary'
            : 'border-border text-foreground'
        ]"
      >
        <svg
          v-if="toast.type === 'success'"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <svg
          v-else-if="toast.type === 'error'"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <svg
          v-else
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>
