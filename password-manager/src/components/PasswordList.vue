<script setup lang="ts">
import { ref } from 'vue'
import type { PasswordEntry } from '../composables/usePasswordDB'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps<{
  entries: PasswordEntry[]
}>()

const emit = defineEmits<{
  edit: [entry: PasswordEntry]
  delete: [id: string]
  toggleFavorite: [entry: PasswordEntry]
}>()

const showPassword = ref<Record<string, boolean>>({})
const copiedId = ref<string | null>(null)
const deleteConfirm = ref<{ show: boolean; id: string; title: string }>({
  show: false,
  id: '',
  title: ''
})

const togglePasswordVisibility = (id: string) => {
  showPassword.value[id] = !showPassword.value[id]
}

const copyToClipboard = async (text: string, id: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const confirmDelete = (id: string, title: string) => {
  deleteConfirm.value = { show: true, id, title }
}

const handleDeleteConfirm = () => {
  emit('delete', deleteConfirm.value.id)
  deleteConfirm.value = { show: false, id: '', title: '' }
}

const handleDeleteCancel = () => {
  deleteConfirm.value = { show: false, id: '', title: '' }
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <div
      v-for="entry in entries"
      :key="entry.id"
      class="rounded-lg border border-border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <!-- 头部：标题、标签、收藏 -->
      <div class="mb-2.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <h3 class="font-semibold truncate">{{ entry.title }}</h3>
          <span class="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary flex-shrink-0">
            {{ entry.category }}
          </span>
        </div>
        <button
          @click="emit('toggleFavorite', entry)"
          class="text-muted-foreground hover:text-yellow-500 flex-shrink-0"
          :class="{ 'text-yellow-500': entry.isFavorite }"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">用户名:</span>
          <div class="flex items-center gap-2">
            <span class="font-mono">{{ entry.username }}</span>
            <button
              @click="copyToClipboard(entry.username, entry.id + '-username')"
              class="text-muted-foreground hover:text-foreground"
            >
              <svg
                v-if="copiedId === entry.id + '-username'"
                class="h-4 w-4 text-green-500"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">密码:</span>
          <div class="flex items-center gap-2">
            <span class="font-mono" :class="{ 'password-dots': !showPassword[entry.id] }">
              {{ showPassword[entry.id] ? entry.password : '••••••••' }}
            </span>
            <button
              @click="togglePasswordVisibility(entry.id)"
              class="text-muted-foreground hover:text-foreground"
            >
              <svg
                v-if="showPassword[entry.id]"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
            <button
              @click="copyToClipboard(entry.password, entry.id + '-password')"
              class="text-muted-foreground hover:text-foreground"
            >
              <svg
                v-if="copiedId === entry.id + '-password'"
                class="h-4 w-4 text-green-500"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="entry.url" class="flex items-center justify-between">
          <span class="text-muted-foreground">网址:</span>
          <a
            :href="entry.url"
            target="_blank"
            class="truncate text-primary hover:underline"
            style="max-width: 200px"
          >
            {{ entry.url }}
          </a>
        </div>

        <div v-if="entry.notes" class="border-t border-border pt-2">
          <span class="text-muted-foreground">备注:</span>
          <p class="mt-1 text-xs">{{ entry.notes }}</p>
        </div>
      </div>

      <div class="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span class="text-muted-foreground">
          {{ formatDate(entry.updatedAt) }}
        </span>
        <div class="flex gap-1.5">
          <button
            @click="emit('edit', entry)"
            class="rounded px-2 py-1 text-primary hover:bg-primary/10 transition-colors"
          >
            编辑
          </button>
          <button
            @click="confirmDelete(entry.id, entry.title)"
            class="rounded px-2 py-1 text-destructive hover:bg-destructive/10 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认对话框 -->
  <ConfirmDialog
    v-if="deleteConfirm.show"
    title="确认删除"
    :message="`确定要删除「${deleteConfirm.title}」吗？此操作无法撤销。`"
    confirm-text="删除"
    cancel-text="取消"
    variant="destructive"
    @confirm="handleDeleteConfirm"
    @cancel="handleDeleteCancel"
  />
</template>
