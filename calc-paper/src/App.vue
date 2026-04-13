<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePaperDB } from '@/composables/usePaperDB'
import type { PaperItem, CalcLine } from '@/types'
import {
  Calculator,
  FileText,
  Plus,
  Trash2,
  Download,
  Upload,
  Save,
  Eraser,
  Check,
  X,
  Clock,
  Edit3
} from 'lucide-vue-next'

// 引入数据库操作方法
const {
  papers,        // 稿纸列表
  isLoading,     // 加载状态
  createPaper,   // 创建稿纸
  savePaper,     // 保存稿纸
  deletePaper,   // 删除稿纸
  renamePaper,   // 重命名稿纸
  exportPapers,  // 导出稿纸
  importPapers   // 导入稿纸
} = usePaperDB()

// ========== 状态定义 ==========
const currentPaper = ref<PaperItem | null>(null)   // 当前选中的稿纸
const editorContent = ref('')                       // 编辑器内容
const copiedLine = ref<number | null>(null)         // 刚刚复制的行号（用于显示提示）
const editingPaperId = ref<string | null>(null)     // 正在重命名的稿纸ID
const editingName = ref('')                         // 重命名输入框的值
const showDeleteConfirm = ref<string | null>(null)  // 显示删除确认的稿纸ID
const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)  // 自动保存定时器
const lastSavedAt = ref<number | null>(null)        // 上次保存时间
const isSaving = ref(false)                         // 是否正在保存

// ========== 界面文字 ==========
const uiText = {
  title: '计算稿纸',
  newPaper: '新建稿纸',
  save: '保存',
  clear: '清空',
  export: '导出',
  import: '导入',
  delete: '删除',
  rename: '重命名',
  cancel: '取消',
  confirm: '确认',
  confirmDelete: '确定要删除这个稿纸吗？',
  emptyPaperList: '暂无保存的稿纸',
  emptyEditor: '在此输入数学表达式...\n例如：\n100 + 200\n50 * 3\nMath.sqrt(16)\n2 ** 10',
  copySuccess: '已复制',
  autoSaved: '已自动保存',
  savedAt: '保存于',
  noPaper: '未选择稿纸',
  clickToCopy: '点击结果复制',
  expression: '表达式',
  result: '结果'
}

// ========== 数学函数映射 ==========
// 这些函数可以在表达式中直接使用
const MATH_FUNCTIONS = {
  sin: Math.sin,      // 正弦
  cos: Math.cos,      // 余弦
  tan: Math.tan,      // 正切
  asin: Math.asin,    // 反正弦
  acos: Math.acos,    // 反余弦
  atan: Math.atan,    // 反正切
  sinh: Math.sinh,    // 双曲正弦
  cosh: Math.cosh,    // 双曲余弦
  tanh: Math.tanh,    // 双曲正切
  sqrt: Math.sqrt,    // 平方根
  abs: Math.abs,      // 绝对值
  ceil: Math.ceil,    // 向上取整
  floor: Math.floor,  // 向下取整
  round: Math.round,  // 四舍五入
  log: Math.log,      // 自然对数
  log10: Math.log10,  // 以10为底的对数
  log2: Math.log2,    // 以2为底的对数
  exp: Math.exp,      // e的幂次方
  pow: Math.pow,      // 幂运算
  min: Math.min,      // 最小值
  max: Math.max,      // 最大值
  PI: Math.PI,        // 圆周率
  E: Math.E           // 自然常数
}

/**
 * 计算表达式的值
 * @param expr 数学表达式字符串
 * @returns 计算结果或错误信息
 */
const evaluateExpression = (expr: string): { result: string | null; error: string | null } => {
  const trimmed = expr.trim()
  
  // 空行不计算
  if (!trimmed) {
    return { result: null, error: null }
  }

  // 跳过纯文字行（以字母或中文开头，且不含函数调用）
  if (/^[a-zA-Z\u4e00-\u9fa5]/.test(trimmed) && !trimmed.includes('(') && !trimmed.includes('=')) {
    return { result: null, error: null }
  }

  try {
    // 构建安全的计算函数
    const funcBody = `
      const { sin, cos, tan, asin, acos, atan, sinh, cosh, tanh,
              sqrt, abs, ceil, floor, round, log, log10, log2, exp,
              pow, min, max, PI, E } = this;
      return ${trimmed};
    `
    // 注意：这里依赖 new Function，只适合受信任输入场景
    const func = new Function(funcBody)
    const rawResult = func.call(MATH_FUNCTIONS)

    // 处理数值结果
    if (typeof rawResult === 'number') {
      // 检查是否为有效数字
      if (!isFinite(rawResult)) {
        return { result: null, error: '结果无效' }
      }
      // 格式化结果：整数直接显示，浮点数保留有效位数
      const result = Number.isInteger(rawResult) 
        ? rawResult.toString() 
        : parseFloat(rawResult.toPrecision(12)).toString()
      return { result, error: null }
    }

    return { result: String(rawResult), error: null }
  } catch {
    return { result: null, error: '表达式错误' }
  }
}

/**
 * 计算所有行的结果
 * 将编辑器内容按行分割，逐行计算
 */
const calcLines = computed<CalcLine[]>(() => {
  const lines = editorContent.value.split('\n')
  return lines.map((line, index) => {
    const { result, error } = evaluateExpression(line)
    return {
      lineNumber: index + 1,  // 行号从1开始
      expression: line,
      result,
      error
    }
  })
})

/**
 * 格式化时间显示
 * @param timestamp 时间戳
 * @returns 友好的时间字符串
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  // 根据时间差显示不同格式
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`

  // 超过一天显示具体日期
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 复制计算结果到剪贴板
 * @param line 要复制的行
 */
const copyResult = async (line: CalcLine) => {
  if (!line.result) return

  try {
    // 优先使用 UniHub 的剪贴板 API
    if (window.unihub?.clipboard) {
      await window.unihub.clipboard.writeText(line.result)
    } else {
      // 降级使用浏览器原生 API
      await navigator.clipboard.writeText(line.result)
    }

    // 显示复制成功提示
    copiedLine.value = line.lineNumber
    setTimeout(() => {
      copiedLine.value = null
    }, 1500)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// ========== 稿纸操作方法 ==========

/** 创建新稿纸 */
const handleNewPaper = async () => {
  try {
    const paper = await createPaper()
    currentPaper.value = paper
    editorContent.value = paper.content
    lastSavedAt.value = null
  } catch (error) {
    console.error('创建稿纸失败:', error)
  }
}

/** 选择稿纸 */
const handleSelectPaper = async (paper: PaperItem) => {
  currentPaper.value = paper
  editorContent.value = paper.content
  lastSavedAt.value = paper.updatedAt
}

/** 保存当前稿纸 */
const handleSavePaper = async () => {
  if (!currentPaper.value) return

  isSaving.value = true
  try {
    currentPaper.value.content = editorContent.value
    await savePaper(currentPaper.value)
    lastSavedAt.value = Date.now()
  } catch (error) {
    console.error('保存稿纸失败:', error)
  } finally {
    isSaving.value = false
  }
}

/** 自动保存（防抖500ms） */
const autoSave = () => {
  // 清除之前的定时器
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }

  // 设置新的定时器
  saveTimeout.value = setTimeout(() => {
    if (currentPaper.value && editorContent.value !== currentPaper.value.content) {
      handleSavePaper()
    }
  }, 500)
}

/** 清空编辑器 */
const handleClearEditor = () => {
  editorContent.value = ''
}

/** 删除稿纸 */
const handleDeletePaper = async (id: string) => {
  try {
    await deletePaper(id)
    // 如果删除的是当前稿纸，清空编辑器
    if (currentPaper.value?.id === id) {
      currentPaper.value = null
      editorContent.value = ''
      lastSavedAt.value = null
    }
    showDeleteConfirm.value = null
  } catch (error) {
    console.error('删除稿纸失败:', error)
  }
}

/** 开始重命名 */
const startRename = (paper: PaperItem) => {
  editingPaperId.value = paper.id
  editingName.value = paper.name
}

/** 取消重命名 */
const cancelRename = () => {
  editingPaperId.value = null
  editingName.value = ''
}

/** 确认重命名 */
const confirmRename = async (id: string) => {
  if (!editingName.value.trim()) return

  try {
    await renamePaper(id, editingName.value.trim())
    // 同步更新当前稿纸名称
    if (currentPaper.value?.id === id) {
      currentPaper.value.name = editingName.value.trim()
    }
    cancelRename()
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

/** 导出稿纸为JSON文件 */
const handleExport = async () => {
  try {
    const jsonData = await exportPapers()
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    // 创建下载链接
    const a = document.createElement('a')
    a.href = url
    a.download = `calc-papers-${new Date().toISOString().slice(0, 10)}.json`
    a.click()

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

/** 从JSON文件导入稿纸 */
const handleImport = async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const count = await importPapers(text)
      console.log(`成功导入 ${count} 个稿纸`)
    } catch (error) {
      console.error('导入失败:', error)
    }
  }

  input.click()
}

// 监听编辑器内容变化，触发自动保存
watch(editorContent, () => {
  autoSave()
})

// 数据加载完成后自动选中第一条，避免 onMounted 时机过早
watch([isLoading, papers], async () => {
  if (!isLoading.value && papers.value.length > 0 && !currentPaper.value) {
    await handleSelectPaper(papers.value[0])
  }
}, { immediate: true })

// 组件卸载时清理自动保存定时器
onBeforeUnmount(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
})
</script>

<template>
  <div class="flex h-full bg-background">
    <!-- 左侧边栏：稿纸列表 -->
    <div class="w-56 bg-card border-r border-border flex flex-col flex-shrink-0">
      <!-- 标题栏 -->
      <div class="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h1 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calculator :size="20" class="text-primary" />
          {{ uiText.title }}
        </h1>
      </div>

      <!-- 新建按钮 -->
      <div class="p-3 border-b border-border">
        <button
          class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          @click="handleNewPaper"
        >
          <Plus :size="16" />
          {{ uiText.newPaper }}
        </button>
      </div>

      <!-- 稿纸列表 -->
      <div class="flex-1 overflow-y-auto p-3">
        <!-- 加载中状态 -->
        <div v-if="isLoading" class="text-center py-8">
          <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p class="text-xs text-muted-foreground">加载中...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="papers.length === 0" class="text-center py-8">
          <FileText :size="32" class="mx-auto text-muted-foreground/30 mb-2" />
          <p class="text-xs text-muted-foreground">{{ uiText.emptyPaperList }}</p>
        </div>

        <!-- 稿纸列表项 -->
        <div v-else class="space-y-1">
          <div
            v-for="paper in papers"
            :key="paper.id"
            :class="[
              'group bg-card border rounded-lg p-2.5 transition-all duration-200 cursor-pointer',
              currentPaper?.id === paper.id
                ? 'border-primary/60 bg-primary/5'
                : 'border-border hover:border-primary/30 hover:bg-accent/50'
            ]"
            @click="handleSelectPaper(paper)"
          >
            <div class="flex items-start gap-2">
              <FileText :size="14" class="flex-shrink-0 mt-0.5 text-muted-foreground" />
              <div class="flex-1 min-w-0">
                <!-- 重命名模式 -->
                <div v-if="editingPaperId === paper.id" class="flex items-center gap-1" @click.stop>
                  <input
                    v-model="editingName"
                    type="text"
                    class="flex-1 px-2 py-1 text-xs bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    @keyup.enter="confirmRename(paper.id)"
                    @keyup.escape="cancelRename"
                    ref="renameInput"
                  />
                  <button
                    class="p-1 text-primary hover:bg-primary/10 rounded"
                    @click="confirmRename(paper.id)"
                  >
                    <Check :size="12" />
                  </button>
                  <button
                    class="p-1 text-muted-foreground hover:bg-accent rounded"
                    @click="cancelRename"
                  >
                    <X :size="12" />
                  </button>
                </div>
                <!-- 正常显示模式 -->
                <div v-else class="flex items-center gap-1">
                  <p class="text-sm font-medium text-foreground truncate flex-1">
                    {{ paper.name }}
                  </p>
                  <!-- 悬停时显示操作按钮 -->
                  <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      class="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                      @click.stop="startRename(paper)"
                      :title="uiText.rename"
                    >
                      <Edit3 :size="12" />
                    </button>
                    <button
                      class="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      @click.stop="showDeleteConfirm = paper.id"
                      :title="uiText.delete"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </div>
                <!-- 更新时间 -->
                <div class="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Clock :size="10" />
                  <span>{{ formatTime(paper.updatedAt) }}</span>
                </div>
              </div>
            </div>

            <!-- 删除确认框 -->
            <div
              v-if="showDeleteConfirm === paper.id"
              class="mt-2 pt-2 border-t border-border flex items-center gap-2"
              @click.stop
            >
              <p class="text-xs text-muted-foreground flex-1">{{ uiText.confirmDelete }}</p>
              <button
                class="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                @click="handleDeletePaper(paper.id)"
              >
                {{ uiText.confirm }}
              </button>
              <button
                class="px-2 py-1 text-xs bg-accent text-accent-foreground rounded hover:bg-accent/80"
                @click="showDeleteConfirm = null"
              >
                {{ uiText.cancel }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部导入导出按钮 -->
      <div class="p-3 border-t border-border space-y-2">
        <button
          class="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/80 transition-colors"
          @click="handleExport"
        >
          <Download :size="14" />
          {{ uiText.export }}
        </button>
        <button
          class="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/80 transition-colors"
          @click="handleImport"
        >
          <Upload :size="14" />
          {{ uiText.import }}
        </button>
      </div>
    </div>

    <!-- 右侧主区域：编辑器 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 工具栏 -->
      <div class="h-14 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <h2 class="text-base font-semibold text-foreground">
          {{ currentPaper?.name || uiText.noPaper }}
        </h2>

        <div class="flex-1"></div>

        <!-- 保存时间 -->
        <div v-if="lastSavedAt" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock :size="12" />
          <span>{{ uiText.savedAt }} {{ formatTime(lastSavedAt) }}</span>
        </div>

        <!-- 保存按钮 -->
        <button
          v-if="currentPaper"
          class="h-8 px-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          :class="{ 'opacity-50': isSaving }"
          :disabled="isSaving"
          @click="handleSavePaper"
        >
          <Save :size="14" :class="{ 'animate-pulse': isSaving }" />
          {{ isSaving ? '保存中...' : uiText.save }}
        </button>

        <!-- 清空按钮 -->
        <button
          class="h-8 px-3 bg-accent text-accent-foreground hover:bg-accent/80 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          @click="handleClearEditor"
          :title="uiText.clear"
        >
          <Eraser :size="14" />
          {{ uiText.clear }}
        </button>
      </div>

      <!-- 编辑区域 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- 未选择稿纸时的提示 -->
        <div v-if="!currentPaper" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <Calculator :size="48" class="mx-auto text-muted-foreground/30 mb-3" />
            <p class="text-sm text-muted-foreground mb-4">{{ uiText.noPaper }}</p>
            <button
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              @click="handleNewPaper"
            >
              {{ uiText.newPaper }}
            </button>
          </div>
        </div>

        <!-- 编辑器主体 -->
        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <!-- 表头 -->
          <div class="flex items-center px-4 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground">
            <span class="w-12 text-center">#</span>
            <span class="flex-1 px-2">{{ uiText.expression }}</span>
            <span class="w-40 text-right pr-4">{{ uiText.result }}</span>
          </div>

          <!-- 编辑器和结果列 -->
          <div class="flex-1 flex overflow-hidden">
            <!-- 左侧：表达式输入区 -->
            <div class="flex-1 overflow-auto">
              <textarea
                v-model="editorContent"
                :placeholder="uiText.emptyEditor"
                class="w-full h-full p-4 bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none leading-6"
                spellcheck="false"
              ></textarea>
            </div>

            <!-- 右侧：计算结果列 -->
            <div class="w-44 border-l border-border bg-muted/10 overflow-auto flex-shrink-0">
              <div
                v-for="line in calcLines"
                :key="line.lineNumber"
                :class="[
                  'h-6 px-3 flex items-center justify-end text-sm font-mono cursor-pointer transition-colors',
                  line.result
                    ? 'text-primary hover:bg-primary/10'
                    : line.error
                      ? 'text-destructive/60'
                      : 'text-muted-foreground/30'
                ]"
                @click="copyResult(line)"
                :title="line.result ? uiText.clickToCopy : ''"
              >
                <!-- 复制成功提示 -->
                <div v-if="copiedLine === line.lineNumber" class="flex items-center gap-1 text-xs text-green-500">
                  <Check :size="12" />
                  <span>{{ uiText.copySuccess }}</span>
                </div>
                <!-- 显示结果 -->
                <span v-else-if="line.result">
                  = {{ line.result }}
                </span>
                <!-- 显示错误 -->
                <span v-else-if="line.error" class="text-xs">
                  {{ line.error }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
