<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as monaco from 'monaco-editor'

// UniHub API
declare global {
  interface Window {
    unihub?: {
      clipboard?: {
        writeText: (text: string) => Promise<void>
        readText: () => Promise<string>
      }
      storage?: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
      }
    }
  }
}

const diffEditorContainer = ref<HTMLElement | null>(null)
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null

const originalCode = ref('')
const modifiedCode = ref('')
const language = ref('javascript')
const theme = ref<'vs' | 'vs-dark'>('vs-dark')
const renderSideBySide = ref(true)
const showLanguageMenu = ref(false)
const isDarkMode = ref(true)

// 支持的语言列表
const languages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
  { value: 'plaintext', label: 'Plain Text' },
]

const currentLanguage = ref(languages.find(l => l.value === language.value) || languages[0])

// 初始化 Monaco Diff Editor
function initDiffEditor() {
  if (!diffEditorContainer.value) return

  diffEditor = monaco.editor.createDiffEditor(diffEditorContainer.value, {
    theme: theme.value,
    automaticLayout: true,
    renderSideBySide: renderSideBySide.value,
    readOnly: false,
    enableSplitViewResizing: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    originalEditable: true,
  })

  updateDiffEditor()
}

// 更新 Diff Editor 内容
function updateDiffEditor() {
  if (!diffEditor) return

  const originalModel = monaco.editor.createModel(originalCode.value, language.value)
  const modifiedModel = monaco.editor.createModel(modifiedCode.value, language.value)

  diffEditor.setModel({
    original: originalModel,
    modified: modifiedModel,
  })
}

// 选择语言
function selectLanguage(lang: typeof languages[0]) {
  language.value = lang.value
  currentLanguage.value = lang
  showLanguageMenu.value = false
  updateDiffEditor()
  saveToStorage()
}

// 切换主题
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  theme.value = isDarkMode.value ? 'vs-dark' : 'vs'
  monaco.editor.setTheme(theme.value)
  saveToStorage()
}

// 切换显示模式
function toggleRenderMode() {
  renderSideBySide.value = !renderSideBySide.value
  if (diffEditor) {
    diffEditor.updateOptions({ renderSideBySide: renderSideBySide.value })
  }
  saveToStorage()
}

// 交换左右代码
function swapCode() {
  const temp = originalCode.value
  originalCode.value = modifiedCode.value
  modifiedCode.value = temp
  updateDiffEditor()
  saveToStorage()
}

// 清空所有内容
function clearAll() {
  originalCode.value = ''
  modifiedCode.value = ''
  updateDiffEditor()
  saveToStorage()
}

// 保存到本地存储
async function saveToStorage() {
  try {
    const data = {
      originalCode: originalCode.value,
      modifiedCode: modifiedCode.value,
      language: language.value,
      theme: theme.value,
      isDarkMode: isDarkMode.value,
      renderSideBySide: renderSideBySide.value,
    }
    
    if (window.unihub?.storage) {
      await window.unihub.storage.set('code-diff-data', JSON.stringify(data))
    } else {
      localStorage.setItem('code-diff-data', JSON.stringify(data))
    }
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 从本地存储加载
async function loadFromStorage() {
  try {
    let dataStr = ''
    if (window.unihub?.storage) {
      dataStr = await window.unihub.storage.get('code-diff-data') || ''
    } else {
      dataStr = localStorage.getItem('code-diff-data') || ''
    }
    
    if (dataStr) {
      const data = JSON.parse(dataStr)
      originalCode.value = data.originalCode || ''
      modifiedCode.value = data.modifiedCode || ''
      language.value = data.language || 'javascript'
      currentLanguage.value = languages.find(l => l.value === language.value) || languages[0]
      isDarkMode.value = data.isDarkMode !== false
      theme.value = isDarkMode.value ? 'vs-dark' : 'vs'
      renderSideBySide.value = data.renderSideBySide !== false
    }
  } catch (error) {
    console.error('加载失败:', error)
  }
}

onMounted(async () => {
  await loadFromStorage()
  initDiffEditor()
  
  // 监听编辑器内容变化
  if (diffEditor) {
    const original = diffEditor.getOriginalEditor()
    const modified = diffEditor.getModifiedEditor()
    
    original.onDidChangeModelContent(() => {
      originalCode.value = original.getValue()
      saveToStorage()
    })
    
    modified.onDidChangeModelContent(() => {
      modifiedCode.value = modified.getValue()
      saveToStorage()
    })
  }

  // 点击外部关闭菜单
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.language-dropdown')) {
      showLanguageMenu.value = false
    }
  })
})

onBeforeUnmount(() => {
  if (diffEditor) {
    diffEditor.dispose()
  }
})
</script>

<template>
  <div class="flex flex-col h-screen" :class="isDarkMode ? 'bg-background' : 'bg-white'">
    <!-- Toolbar -->
    <div 
      class="flex items-center gap-3 px-4 py-2 border-b transition-colors"
      :class="isDarkMode ? 'bg-background border-border' : 'bg-white border-gray-200'"
    >
      <!-- Title -->
      <h1 class="text-sm font-semibold" :class="isDarkMode ? 'text-foreground' : 'text-gray-900'">
        代码对比
      </h1>

      <!-- Language Dropdown -->
      <div class="relative language-dropdown">
        <button
          @click.stop="showLanguageMenu = !showLanguageMenu"
          class="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors min-w-[140px]"
          :class="isDarkMode 
            ? 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground' 
            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'"
        >
          <span>{{ currentLanguage.label }}</span>
          <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showLanguageMenu }" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="showLanguageMenu"
          class="absolute top-full left-0 mt-1 w-48 border rounded-md shadow-lg overflow-hidden z-50"
          :class="isDarkMode ? 'bg-popover border-border' : 'bg-white border-gray-200'"
        >
          <div class="max-h-80 overflow-y-auto p-1">
            <button
              v-for="lang in languages"
              :key="lang.value"
              @click="selectLanguage(lang)"
              class="w-full px-2 py-1.5 text-sm text-left rounded-sm transition-colors flex items-center justify-between"
              :class="[
                lang.value === language 
                  ? isDarkMode ? 'bg-accent text-accent-foreground' : 'bg-gray-100 text-gray-900'
                  : isDarkMode 
                    ? 'text-foreground hover:bg-accent hover:text-accent-foreground' 
                    : 'text-gray-700 hover:bg-gray-100'
              ]"
            >
              <span>{{ lang.label }}</span>
              <svg v-if="lang.value === language" class="w-4 h-4" :class="isDarkMode ? 'text-primary' : 'text-gray-900'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1"></div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <!-- Theme Toggle -->
        <button
          @click="toggleTheme"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors"
          :class="isDarkMode 
            ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
          :title="isDarkMode ? '切换到亮色模式' : '切换到暗色模式'"
        >
          <svg v-if="isDarkMode" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4" stroke-width="2"/>
            <path d="M12 2v2m0 16v2M4 12H2m4.31-5.69L5 5m12.69 1.31L19 5M6.31 17.69L5 19m12.69-1.31L19 19M22 12h-2" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- View Mode Toggle -->
        <button
          @click="toggleRenderMode"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors"
          :class="isDarkMode 
            ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
          :title="renderSideBySide ? '切换到内联模式' : '切换到并排模式'"
        >
          <svg v-if="renderSideBySide" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="8" height="18" rx="1" stroke-width="2"/>
            <rect x="13" y="3" width="8" height="18" rx="1" stroke-width="2"/>
          </svg>
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="1" stroke-width="2"/>
            <line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/>
          </svg>
        </button>

        <div class="w-px h-5" :class="isDarkMode ? 'bg-border' : 'bg-gray-200'"></div>

        <!-- Swap -->
        <button
          @click="swapCode"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95"
          :class="isDarkMode 
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md' 
            : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md'"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>交换</span>
        </button>

        <!-- Clear -->
        <button
          @click="clearAll"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95"
          :class="isDarkMode 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md' 
            : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md'"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 6H5H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- Diff Editor -->
    <div ref="diffEditorContainer" class="flex-1 overflow-hidden"></div>
  </div>
</template>
