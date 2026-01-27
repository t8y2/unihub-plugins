<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  use: [password: string]
  close: []
}>()

const length = ref(16)
const includeUppercase = ref(true)
const includeLowercase = ref(true)
const includeNumbers = ref(true)
const includeSymbols = ref(true)
const generatedPassword = ref('')
const copied = ref(false)

const passwordStrength = computed(() => {
  const len = generatedPassword.value.length
  if (len === 0) return { label: '', color: '' }
  if (len < 8) return { label: '弱', color: 'text-red-500' }
  if (len < 12) return { label: '中等', color: 'text-yellow-500' }
  if (len < 16) return { label: '强', color: 'text-green-500' }
  return { label: '非常强', color: 'text-green-600' }
})

const generatePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let chars = ''
  let password = ''

  if (includeUppercase.value) chars += uppercase
  if (includeLowercase.value) chars += lowercase
  if (includeNumbers.value) chars += numbers
  if (includeSymbols.value) chars += symbols

  if (chars.length === 0) {
    alert('请至少选择一种字符类型')
    return
  }

  // 确保至少包含每种选中的字符类型
  if (includeUppercase.value) password += uppercase[Math.floor(Math.random() * uppercase.length)]
  if (includeLowercase.value) password += lowercase[Math.floor(Math.random() * lowercase.length)]
  if (includeNumbers.value) password += numbers[Math.floor(Math.random() * numbers.length)]
  if (includeSymbols.value) password += symbols[Math.floor(Math.random() * symbols.length)]

  // 填充剩余长度
  for (let i = password.length; i < length.value; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }

  // 打乱顺序
  generatedPassword.value = password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedPassword.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const usePassword = () => {
  if (!generatedPassword.value) {
    alert('请先生成密码')
    return
  }
  emit('use', generatedPassword.value)
}

// 初始生成一个密码
generatePassword()

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
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
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-bold">密码生成器</h2>
        <button @click="emit('close')" class="text-muted-foreground hover:text-foreground">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <!-- 生成的密码 -->
        <div>
          <div
            class="flex items-center justify-between rounded-lg border border-input bg-background p-4"
          >
            <span class="flex-1 break-all font-mono text-lg">
              {{ generatedPassword || '点击生成密码' }}
            </span>
            <button
              v-if="generatedPassword"
              @click="copyToClipboard"
              class="ml-2 text-muted-foreground hover:text-foreground"
            >
              <svg
                v-if="copied"
                class="h-5 w-5 text-green-500"
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
                class="h-5 w-5"
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
          <div v-if="generatedPassword" class="mt-2 text-sm">
            密码强度: <span :class="passwordStrength.color">{{ passwordStrength.label }}</span>
          </div>
        </div>

        <!-- 长度设置 -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <label class="text-sm font-medium">长度</label>
            <span class="text-sm text-muted-foreground">{{ length }}</span>
          </div>
          <input
            v-model.number="length"
            type="range"
            min="8"
            max="32"
            class="w-full"
            @input="generatePassword"
          />
          <div class="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>8</span>
            <span>32</span>
          </div>
        </div>

        <!-- 字符类型选项 -->
        <div class="space-y-2">
          <label class="flex items-center gap-2">
            <input
              v-model="includeUppercase"
              type="checkbox"
              class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              @change="generatePassword"
            />
            <span class="text-sm">大写字母 (A-Z)</span>
          </label>

          <label class="flex items-center gap-2">
            <input
              v-model="includeLowercase"
              type="checkbox"
              class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              @change="generatePassword"
            />
            <span class="text-sm">小写字母 (a-z)</span>
          </label>

          <label class="flex items-center gap-2">
            <input
              v-model="includeNumbers"
              type="checkbox"
              class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              @change="generatePassword"
            />
            <span class="text-sm">数字 (0-9)</span>
          </label>

          <label class="flex items-center gap-2">
            <input
              v-model="includeSymbols"
              type="checkbox"
              class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
              @change="generatePassword"
            />
            <span class="text-sm">符号 (!@#$%^&*)</span>
          </label>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3 border-t border-border pt-4">
          <button
            @click="generatePassword"
            class="flex-1 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            重新生成
          </button>
          <button
            @click="usePassword"
            class="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            使用此密码
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
