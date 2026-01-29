import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

// 同步主应用的深色模式
const syncTheme = () => {
  // 检查主应用的主题设置
  const theme = localStorage.getItem('unihub-theme')
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  document.documentElement.classList.toggle('dark', isDark)
  console.log('[剪贴板插件] 主题已同步:', isDark ? 'dark' : 'light')
}

// 初始化主题
syncTheme()

// 监听主应用的主题变化事件（通过 IPC）
if (window.electron?.ipcRenderer) {
  window.electron.ipcRenderer.on('theme-changed', (_event: unknown, ...args: unknown[]) => {
    const theme = args[0] as 'light' | 'dark'
    console.log('[剪贴板插件] 收到主题变化通知:', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  })
}

// 监听系统主题变化（当主应用设置为 system 时）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = localStorage.getItem('unihub-theme')
  if (theme === 'system') {
    syncTheme()
  }
})
