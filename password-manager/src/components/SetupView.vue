<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  setup: [password: string]
}>()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')

const handleSubmit = () => {
  error.value = ''

  if (password.value.length < 8) {
    error.value = '主密码至少需要8个字符'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  emit('setup', password.value)
}
</script>

<template>
  <div class="flex h-full items-center justify-center bg-background p-6">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold">设置主密码</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          主密码用于加密您的所有密码数据，请妥善保管
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium">主密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="至少8个字符"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium">确认主密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="再次输入主密码"
            class="w-full rounded-lg border border-input bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div v-if="error" class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <button
          type="submit"
          class="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
        >
          设置主密码
        </button>
      </form>

      <div class="mt-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        <p class="font-medium">⚠️ 重要提示：</p>
        <ul class="mt-2 list-inside list-disc space-y-1">
          <li>主密码无法找回，请务必牢记</li>
          <li>建议使用强密码，包含大小写字母、数字和符号</li>
          <li>不要与其他网站使用相同的密码</li>
        </ul>
      </div>
    </div>
  </div>
</template>
