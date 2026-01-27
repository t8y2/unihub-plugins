<script setup lang="ts">
import { ref } from 'vue'
import { FileText, Plus, Download, X, GripVertical, HelpCircle, Combine } from 'lucide-vue-next'
import { PDFDocument } from 'pdf-lib'
import { toast } from 'vue-sonner'
import { Toaster } from '@/components/ui/sonner'
import Button from '@/components/ui/button/Button.vue'

interface PDFItem {
  file: File
  name: string
  size: number
  pages: number
}

const fileInput = ref<HTMLInputElement>()
const pdfFiles = ref<PDFItem[]>([])
const merging = ref(false)
const draggedIndex = ref<number | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  await addPDFs(files)
}

const handleDrop = async (e: DragEvent) => {
  const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type === 'application/pdf')
  await addPDFs(files)
}

const addPDFs = async (files: File[]) => {
  for (const file of files) {
    if (file.type !== 'application/pdf') {
      toast.warning(`跳过 ${file.name}：不是 PDF 文件`)
      continue
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageCount = pdfDoc.getPageCount()

      pdfFiles.value.push({
        file,
        name: file.name,
        size: file.size,
        pages: pageCount
      })
    } catch (error) {
      toast.error(`无法读取 ${file.name}: ${(error as Error).message}`)
    }
  }

  const validCount = files.filter(f => f.type === 'application/pdf').length
  if (validCount > 0) {
    toast.success(`已添加 ${validCount} 个 PDF 文件`)
  }
}

const removePDF = (index: number) => {
  pdfFiles.value.splice(index, 1)
  toast.info('已移除')
}

const clearAll = () => {
  if (pdfFiles.value.length === 0) {
    toast.warning('没有 PDF 文件')
    return
  }
  pdfFiles.value = []
  toast.success('已清空')
}

const mergePDFs = async () => {
  if (pdfFiles.value.length < 2) {
    toast.warning('请至少添加 2 个 PDF 文件')
    return
  }

  merging.value = true

  try {
    const mergedPdf = await PDFDocument.create()

    for (const pdfItem of pdfFiles.value) {
      const arrayBuffer = await pdfItem.file.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      copiedPages.forEach((page) => mergedPdf.addPage(page))
    }

    const mergedPdfBytes = await mergedPdf.save()
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `merged_${Date.now()}.pdf`
    a.click()

    URL.revokeObjectURL(url)
    toast.success('PDF 合并完成！')
  } catch (error) {
    toast.error('合并失败: ' + (error as Error).message)
  } finally {
    merging.value = false
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 拖拽排序
const onDragStart = (index: number) => {
  draggedIndex.value = index
}

const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === index) return

  const items = [...pdfFiles.value]
  const draggedItem = items[draggedIndex.value]
  items.splice(draggedIndex.value, 1)
  items.splice(index, 0, draggedItem)
  pdfFiles.value = items
  draggedIndex.value = index
}

const onDragEnd = () => {
  draggedIndex.value = null
}
</script>

<template>
  <Toaster position="top-center" :duration="1500" rich-colors />
  <div class="flex-1 flex flex-col min-h-0">
    <!-- 工具栏 -->
    <div
      class="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-2 flex-shrink-0"
    >
      <Button size="sm" @click="triggerFileInput">
        <Plus class="w-4 h-4 mr-2" />
        添加 PDF
      </Button>

      <Button size="sm" variant="secondary" @click="mergePDFs" :disabled="merging || pdfFiles.length < 2">
        <Combine class="w-4 h-4 mr-2" />
        {{ merging ? '合并中...' : '合并 PDF' }}
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

      <div class="ml-auto text-sm text-gray-600 dark:text-gray-400">
        {{ pdfFiles.length }} 个文件
        <span v-if="pdfFiles.length > 0">
          · {{ pdfFiles.reduce((sum, pdf) => sum + pdf.pages, 0) }} 页
        </span>
      </div>

      <!-- 帮助提示 -->
      <div class="relative group">
        <button class="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <HelpCircle class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        
        <div class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div class="text-xs text-gray-600 dark:text-gray-400 space-y-2">
            <p class="font-semibold text-gray-900 dark:text-gray-100 mb-2">使用说明</p>
            <ul class="list-disc list-inside space-y-1">
              <li>支持拖拽上传多个 PDF 文件</li>
              <li>拖动文件卡片可调整合并顺序</li>
              <li>点击"合并 PDF"生成合并后的文件</li>
              <li>所有处理均在浏览器本地完成，不会上传到服务器</li>
            </ul>
          </div>
          <div class="absolute -top-2 right-3 w-4 h-4 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="flex-1 overflow-auto min-h-0">
      <!-- 空状态 - 上传区域 -->
      <div
        v-if="pdfFiles.length === 0"
        @drop.prevent="handleDrop"
        @dragover.prevent
        @click="triggerFileInput"
        class="h-full flex items-center justify-center p-8"
      >
        <div class="text-center cursor-pointer">
          <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <FileText class="w-12 h-12 text-gray-400 dark:text-gray-600" />
          </div>
          <p class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">拖拽 PDF 文件到这里或点击上传</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">支持批量上传，可拖拽调整合并顺序</p>
        </div>
      </div>

      <!-- PDF 文件列表 -->
      <div v-else class="p-6">
        <div class="max-w-3xl mx-auto space-y-3">
          <div
            v-for="(pdf, index) in pdfFiles"
            :key="index"
            draggable="true"
            @dragstart="onDragStart(index)"
            @dragover="onDragOver($event, index)"
            @dragend="onDragEnd"
            class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-move"
            :class="{ 'opacity-50': draggedIndex === index }"
          >
            <div class="flex items-center gap-4">
              <!-- 拖拽手柄 -->
              <div class="flex-shrink-0 text-gray-400 dark:text-gray-600">
                <GripVertical class="w-5 h-5" />
              </div>

              <!-- PDF 图标 -->
              <div class="flex-shrink-0 w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <FileText class="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>

              <!-- 文件信息 -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" :title="pdf.name">
                  {{ pdf.name }}
                </p>
                <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{{ formatSize(pdf.size) }}</span>
                  <span>·</span>
                  <span>{{ pdf.pages }} 页</span>
                </div>
              </div>

              <!-- 序号 -->
              <div class="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ index + 1 }}</span>
              </div>

              <!-- 删除按钮 -->
              <button
                @click="removePDF(index)"
                class="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/pdf"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>
