<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { PasswordEntry } from '../composables/usePasswordDB'

const props = defineProps<{
  entry: PasswordEntry | null
  generatedPassword?: string
}>()

const emit = defineEmits<{
  save: [entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

const form = ref({
  title: '',
  username: '',
  password: '',
  url: '',
  category: '网站',
  notes: '',
  isFavorite: false
})

const categories = ['网站', '应用', '邮箱', '银行', '社交', '工作', '其他']

watch(
  () => props.entry,
  (entry) => {
    if (entry) {
      form.value = {
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url || '',
        category: entry.category,
        notes: entry.notes || '',
        isFavorite: entry.isFavorite || false
      }
    } else {
      form.value = {
        title: '',
        username: '',
        password: '',
        url: '',
        category: '网站',
        notes: '',
        isFavorite: false
      }
    }
  },
  { immediate: true }
)

// 监听生成的密码
watch(
  () => props.generatedPassword,
  (password) => {
    if (password) {
      form.value.password = password
    }
  },
  { immediate: true }
)

const handleSubmit = () => {
  if (!form.value.title || !form.value.username || !form.value.password) {
    alert('请填写必填项')
    return
  }

  emit('save', form.value)
}

const showPassword = ref(false)

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('cancel')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
    <div class="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl">
      <h2 class="mb-6 text-xl font-bold">{{ entry ? '编辑密码' : '添加密码' }}</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-2 block text-sm font-medium">
              标题 <span class="text-destructive">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              placeholder="例如：GitHub"
              class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium">分类</label>
            <select
              v-model="form.category"
              class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium">
            用户名/邮箱 <span class="text-destructive">*</span>
          </label>
          <input
            v-model="form.username"
            type="text"
            placeholder="例如：user@example.com"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium">
            密码 <span class="text-destructive">*</span>
          </label>
          <div class="relative">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="输入密码"
              class="w-full rounded-lg border border-input bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg
                v-if="showPassword"
                class="h-5 w-5"
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
              <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          </div>
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium">网址（可选）</label>
          <input
            v-model="form.url"
            type="url"
            placeholder="https://example.com"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium">备注（可选）</label>
          <textarea
            v-model="form.notes"
            placeholder="添加备注信息..."
            rows="3"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          ></textarea>
        </div>

        <div class="flex items-center gap-2">
          <input
            v-model="form.isFavorite"
            type="checkbox"
            id="favorite"
            class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
          />
          <label for="favorite" class="text-sm font-medium">添加到收藏夹</label>
        </div>

        <div class="flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            @click="emit('cancel')"
            class="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
