<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  unlock: [password: string, callback: (success: boolean) => void]
}>()

const { showToast } = useToast()

const password = ref('')
const isLoading = ref(false)

const handleSubmit = async () => {
  isLoading.value = true

  emit('unlock', password.value, (success: boolean) => {
    isLoading.value = false
    if (!success) {
      showToast('密码错误，请重试', 'error')
      password.value = ''
    }
  })
}
</script>

<template>
  <div class="flex h-full items-center justify-center bg-background p-6">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            class="h-8 w-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-bold">密码管理器已锁定</h1>
        <p class="mt-2 text-sm text-muted-foreground">请输入主密码以解锁</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium">主密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="输入主密码"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            :disabled="isLoading"
            required
            autofocus
          />
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {{ isLoading ? '解锁中...' : '解锁' }}
        </button>
      </form>
    </div>
  </div>
</template>
