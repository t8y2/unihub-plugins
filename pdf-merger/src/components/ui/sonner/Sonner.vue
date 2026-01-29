<script setup lang="ts">
import { Toaster as Sonner } from 'vue-sonner'

interface Props {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  duration?: number
  richColors?: boolean
}

withDefaults(defineProps<Props>(), {
  position: 'top-center',
  duration: 2000,
  richColors: true
})
</script>

<template>
  <Sonner :position="position" :duration="duration" :rich-colors="richColors" />
</template>
