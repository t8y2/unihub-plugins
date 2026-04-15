<template>
  <div class="flex flex-col min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
    <!-- 头部 -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div class="flex items-center gap-2">
        <h1 class="text-[15px] font-semibold tracking-tight">端口管理器</h1>
        <span
          v-if="!loading"
          class="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full"
        >
          {{ filteredPorts.length }} 个端口
        </span>
      </div>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
        :disabled="loading"
        title="刷新"
        @click="refresh"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
      </button>
    </header>

    <!-- 过滤栏 -->
    <div class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-wrap">
      <div class="relative flex-1 min-w-[180px]">
        <Search :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          class="w-full pl-7 pr-7 py-1.5 text-[13px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
          placeholder="搜索端口号、进程名或 PID..."
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          @click="searchQuery = ''"
        >
          <X :size="12" />
        </button>
      </div>
      <div class="flex border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-[12px] font-medium">
        <button
          v-for="tab in protocolTabs"
          :key="tab.value"
          class="px-3 py-1.5 transition-colors"
          :class="protocolFilter === tab.value
            ? 'bg-indigo-500 dark:bg-indigo-600 text-white'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-r border-slate-200 dark:border-slate-700 last:border-r-0'"
          @click="protocolFilter = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-auto">
      <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
        <Loader2 :size="26" class="animate-spin text-indigo-500" />
        <p class="text-sm">正在获取端口信息...</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center gap-3 py-16 text-red-500 dark:text-red-400">
        <AlertCircle :size="26" />
        <p class="text-sm">{{ error }}</p>
        <button
          class="mt-1 px-4 py-1.5 text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors"
          @click="refresh"
        >
          重试
        </button>
      </div>

      <div v-else-if="filteredPorts.length === 0" class="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
        <Unplug :size="26" />
        <p class="text-sm">没有找到匹配的端口</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-[13px] border-collapse">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-[12px] font-medium">
              <th
                v-for="col in columns"
                :key="col.field"
                class="px-3 py-2 text-left whitespace-nowrap border-b border-slate-200 dark:border-slate-700 select-none"
                :class="col.sortable ? 'cursor-pointer hover:text-slate-900 dark:hover:text-slate-100' : ''"
                @click="col.sortable ? sortBy(col.field as SortField) : undefined"
              >
                {{ col.label }}
                <template v-if="col.sortable">
                  <ChevronUp v-if="sortField === col.field && sortDir === 'asc'" :size="11" class="inline ml-0.5 text-indigo-500" />
                  <ChevronDown v-else-if="sortField === col.field && sortDir === 'desc'" :size="11" class="inline ml-0.5 text-indigo-500" />
                  <ChevronsUpDown v-else :size="11" class="inline ml-0.5 opacity-40" />
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in sortedPorts"
              :key="`${p.pid}-${p.port}-${p.protocol}`"
              class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <td class="px-3 py-2">
                <span class="font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{{ p.port }}</span>
              </td>
              <td class="px-3 py-2">
                <span
                  class="inline-block px-1.5 py-0.5 text-[11px] font-semibold rounded tracking-wide border"
                  :class="p.protocol === 'TCP'
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'"
                >
                  {{ p.protocol }}
                </span>
              </td>
              <td class="px-3 py-2 max-w-[160px] truncate text-slate-700 dark:text-slate-300" :title="p.name">
                {{ p.name || '—' }}
              </td>
              <td class="px-3 py-2 tabular-nums text-slate-500 dark:text-slate-400">{{ p.pid }}</td>
              <td class="px-3 py-2 text-[12px] text-slate-400 dark:text-slate-500">{{ p.address || '—' }}</td>
              <td class="px-3 py-2">
                <button
                  class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="killing === p.pid"
                  @click="confirmKill(p)"
                >
                  <Loader2 v-if="killing === p.pid" :size="11" class="animate-spin" />
                  <X v-else :size="11" />
                  关闭
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <Teleport to="body">
      <div
        v-if="confirmTarget"
        class="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm"
        @click.self="confirmTarget = null"
      >
        <div class="w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-6">
          <div class="flex justify-center mb-3">
            <AlertTriangle :size="24" class="text-amber-500" />
          </div>
          <h2 class="text-[15px] font-semibold text-center mb-2">关闭进程</h2>
          <p class="text-[13px] text-slate-500 dark:text-slate-400 text-center mb-1">
            确定要关闭进程
            <strong class="text-slate-800 dark:text-slate-200">{{ confirmTarget.name || 'Unknown' }}</strong>
            (PID: {{ confirmTarget.pid }}) 吗？
          </p>
          <p class="text-[12px] text-slate-400 dark:text-slate-500 text-center mb-5">
            该进程正在占用端口 <strong class="text-slate-700 dark:text-slate-300">{{ confirmTarget.port }}</strong>
          </p>
          <div class="flex gap-2">
            <button
              class="flex-1 py-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              @click="confirmTarget = null"
            >
              取消
            </button>
            <button
              class="flex-1 py-1.5 text-[13px] font-medium bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
              @click="doKill"
            >
              确认关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  RefreshCw,
  Search,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Unplug,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-vue-next'

interface PortInfo {
  pid: number
  name: string
  port: number
  protocol: 'TCP' | 'UDP'
  state: string
  address: string
}

type SortField = 'port' | 'protocol' | 'name' | 'pid'
type SortDir = 'asc' | 'desc'

const ports = ref<PortInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const killing = ref<number | null>(null)
const confirmTarget = ref<PortInfo | null>(null)

const searchQuery = ref('')
const protocolFilter = ref<'ALL' | 'TCP' | 'UDP'>('ALL')
const sortField = ref<SortField>('port')
const sortDir = ref<SortDir>('asc')

const protocolTabs: { label: string; value: 'ALL' | 'TCP' | 'UDP' }[] = [
  { label: '全部', value: 'ALL' },
  { label: 'TCP', value: 'TCP' },
  { label: 'UDP', value: 'UDP' }
]

const columns: { label: string; field: string; sortable: boolean }[] = [
  { label: '端口', field: 'port', sortable: true },
  { label: '协议', field: 'protocol', sortable: true },
  { label: '进程名', field: 'name', sortable: true },
  { label: 'PID', field: 'pid', sortable: true },
  { label: '地址', field: 'address', sortable: false },
  { label: '操作', field: 'action', sortable: false }
]

const filteredPorts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return ports.value.filter((p) => {
    if (protocolFilter.value !== 'ALL' && p.protocol !== protocolFilter.value) return false
    if (!q) return true
    return (
      String(p.port).includes(q) ||
      p.name.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      p.address.toLowerCase().includes(q)
    )
  })
})

const sortedPorts = computed(() => {
  const list = [...filteredPorts.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const va = a[sortField.value as keyof PortInfo]
    const vb = b[sortField.value as keyof PortInfo]
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

function sortBy(field: SortField) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    ports.value = await window.unihub.system.getPorts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '获取端口信息失败'
  } finally {
    loading.value = false
  }
}

function confirmKill(p: PortInfo) {
  confirmTarget.value = p
}

async function doKill() {
  if (!confirmTarget.value) return
  const target = confirmTarget.value
  confirmTarget.value = null
  killing.value = target.pid
  try {
    await window.unihub.system.killProcess(target.pid)
    await new Promise((r) => setTimeout(r, 500))
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '关闭进程失败'
  } finally {
    killing.value = null
  }
}

onMounted(refresh)
</script>
