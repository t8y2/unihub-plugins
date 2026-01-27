<script setup lang="ts">
const props = defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
      <h2 class="mb-3 text-lg font-semibold text-card-foreground">{{ title }}</h2>
      <p class="mb-6 text-sm text-muted-foreground">{{ message }}</p>
      
      <div class="flex justify-end gap-3">
        <button
          @click="emit('cancel')"
          class="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {{ cancelText || '取消' }}
        </button>
        <button
          @click="emit('confirm')"
          :class="[
            'rounded-lg px-4 py-2 text-sm font-medium',
            variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          ]"
        >
          {{ confirmText || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>
