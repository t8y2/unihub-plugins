import { reactive } from 'vue'

interface Toast {
  visible: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

const toast = reactive<Toast>({
  visible: false,
  message: '',
  type: 'success'
})

export function useToast() {
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    toast.message = message
    toast.type = type
    toast.visible = true

    setTimeout(() => {
      toast.visible = false
    }, 3000)
  }

  return {
    toast,
    showToast
  }
}
