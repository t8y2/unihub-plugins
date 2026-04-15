<template>
  <div class="app">
    <!-- 头部 -->
    <header class="header">
      <div class="header-left">
        <span class="header-icon">🔌</span>
        <h1 class="header-title">端口管理器</h1>
        <span class="port-count" v-if="!loading"
          >{{ filteredPorts.length }} 个端口</span
        >
      </div>
      <div class="header-right">
        <button
          class="btn btn-ghost"
          @click="refresh"
          :disabled="loading"
          title="刷新"
        >
          <RefreshCw :size="15" :class="{ spin: loading }" />
        </button>
      </div>
    </header>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <div class="search-wrapper">
        <Search :size="14" class="search-icon" />
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="搜索端口号、进程名或 PID..."
          type="text"
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
          <X :size="12" />
        </button>
      </div>
      <div class="protocol-tabs">
        <button
          v-for="tab in protocolTabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: protocolFilter === tab.value }"
          @click="protocolFilter = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="content">
      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <Loader2 :size="28" class="spin text-accent" />
        <p>正在获取端口信息...</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="empty-state error">
        <AlertCircle :size="28" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="refresh">重试</button>
      </div>

      <!-- 空结果 -->
      <div v-else-if="filteredPorts.length === 0" class="empty-state">
        <Unplug :size="28" class="text-muted" />
        <p class="text-muted">没有找到匹配的端口</p>
      </div>

      <!-- 端口表格 -->
      <div v-else class="table-wrapper">
        <table class="port-table">
          <thead>
            <tr>
              <th @click="sortBy('port')" class="sortable">
                端口
                <SortIcon field="port" />
              </th>
              <th @click="sortBy('protocol')" class="sortable">
                协议
                <SortIcon field="protocol" />
              </th>
              <th @click="sortBy('name')" class="sortable">
                进程名
                <SortIcon field="name" />
              </th>
              <th @click="sortBy('pid')" class="sortable">
                PID
                <SortIcon field="pid" />
              </th>
              <th>地址</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in sortedPorts"
              :key="`${p.pid}-${p.port}-${p.protocol}`"
              class="port-row"
            >
              <td>
                <span class="port-number">{{ p.port }}</span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="p.protocol === 'TCP' ? 'badge-tcp' : 'badge-udp'"
                >
                  {{ p.protocol }}
                </span>
              </td>
              <td class="process-name" :title="p.name">{{ p.name || "—" }}</td>
              <td class="pid-cell">{{ p.pid }}</td>
              <td class="address-cell">{{ p.address || "—" }}</td>
              <td>
                <button
                  class="btn btn-danger btn-sm"
                  @click="confirmKill(p)"
                  :disabled="killing === p.pid"
                  title="关闭进程"
                >
                  <Loader2 v-if="killing === p.pid" :size="12" class="spin" />
                  <X v-else :size="12" />
                  关闭
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <div
      v-if="confirmTarget"
      class="modal-overlay"
      @click.self="confirmTarget = null"
    >
      <div class="modal">
        <div class="modal-icon">
          <AlertTriangle :size="24" class="text-warning" />
        </div>
        <h2 class="modal-title">关闭进程</h2>
        <p class="modal-body">
          确定要关闭进程
          <strong>{{ confirmTarget.name || "Unknown" }}</strong>
          (PID: {{ confirmTarget.pid }}) 吗？
        </p>
        <p class="modal-sub">
          该进程正在占用端口 <strong>{{ confirmTarget.port }}</strong>
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="confirmTarget = null">
            取消
          </button>
          <button class="btn btn-danger" @click="doKill">确认关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from "vue";
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
  ChevronsUpDown,
} from "lucide-vue-next";

interface PortInfo {
  pid: number;
  name: string;
  port: number;
  protocol: "TCP" | "UDP";
  state: string;
  address: string;
}

type SortField = "port" | "protocol" | "name" | "pid";
type SortDir = "asc" | "desc";

// --- 状态 ---
const ports = ref<PortInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const killing = ref<number | null>(null);
const confirmTarget = ref<PortInfo | null>(null);

const searchQuery = ref("");
const protocolFilter = ref<"ALL" | "TCP" | "UDP">("ALL");
const sortField = ref<SortField>("port");
const sortDir = ref<SortDir>("asc");

const protocolTabs = [
  { label: "全部", value: "ALL" as const },
  { label: "TCP", value: "TCP" as const },
  { label: "UDP", value: "UDP" as const },
];

// --- 计算 ---
const filteredPorts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return ports.value.filter((p) => {
    if (protocolFilter.value !== "ALL" && p.protocol !== protocolFilter.value)
      return false;
    if (!q) return true;
    return (
      String(p.port).includes(q) ||
      p.name.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      p.address.toLowerCase().includes(q)
    );
  });
});

const sortedPorts = computed(() => {
  const list = [...filteredPorts.value];
  const dir = sortDir.value === "asc" ? 1 : -1;
  return list.sort((a, b) => {
    const va = a[sortField.value];
    const vb = b[sortField.value];
    if (typeof va === "number" && typeof vb === "number")
      return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
});

// --- 排序图标组件 ---
const SortIcon = (props: { field: SortField }) => {
  if (sortField.value !== props.field)
    return h(ChevronsUpDown, { size: 12, class: "sort-icon muted" });
  return sortDir.value === "asc"
    ? h(ChevronUp, { size: 12, class: "sort-icon active" })
    : h(ChevronDown, { size: 12, class: "sort-icon active" });
};

// --- 方法 ---
function sortBy(field: SortField) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortDir.value = "asc";
  }
}

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    ports.value = await window.unihub.system.getPorts();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取端口信息失败";
  } finally {
    loading.value = false;
  }
}

function confirmKill(p: PortInfo) {
  confirmTarget.value = p;
}

async function doKill() {
  if (!confirmTarget.value) return;
  const target = confirmTarget.value;
  confirmTarget.value = null;
  killing.value = target.pid;
  try {
    await window.unihub.system.killProcess(target.pid);
    // 稍等后刷新，让系统有时间释放端口
    await new Promise((r) => setTimeout(r, 500));
    await refresh();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "关闭进程失败";
  } finally {
    killing.value = null;
  }
}

onMounted(refresh);
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* 头部 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-icon {
  font-size: 18px;
  line-height: 1;
}
.header-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.port-count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 1px 7px;
  border-radius: 20px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 过滤栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}
.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 6px 28px 6px 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: var(--accent);
}
.search-input::placeholder {
  color: var(--text-muted);
}
.clear-btn {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 3px;
}
.clear-btn:hover {
  color: var(--text-primary);
}
.protocol-tabs {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}
.tab-btn {
  padding: 5px 12px;
  background: var(--bg-card);
  border: none;
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.tab-btn:last-child {
  border-right: none;
}
.tab-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.tab-btn.active {
  background: var(--accent);
  color: #fff;
}

/* 内容区 */
.content {
  flex: 1;
  overflow: auto;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.empty-state.error {
  color: var(--danger);
}
.text-muted {
  color: var(--text-muted);
}
.text-accent {
  color: var(--accent);
}

/* 表格 */
.table-wrapper {
  overflow-x: auto;
}
.port-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.port-table th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-weight: 500;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  white-space: nowrap;
}
.port-table th.sortable {
  cursor: pointer;
  user-select: none;
  display: table-cell;
}
.port-table th.sortable:hover {
  color: var(--text-primary);
}
.port-table th {
  display: table-cell;
}
.sort-icon {
  display: inline-block;
  vertical-align: middle;
  margin-left: 3px;
}
.sort-icon.muted {
  color: var(--text-muted);
}
.sort-icon.active {
  color: var(--accent);
}
.port-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}
.port-row:hover td {
  background: var(--bg-secondary);
}
.port-number {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.badge-tcp {
  background: rgba(99, 102, 241, 0.12);
  color: var(--accent);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.badge-udp {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warning);
  border: 1px solid rgba(245, 158, 11, 0.25);
}
.process-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pid-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.address-cell {
  color: var(--text-muted);
  font-size: 12px;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid transparent;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-ghost {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
.btn-danger {
  background: var(--danger);
  color: #fff;
  border-color: var(--danger);
}
.btn-danger:hover:not(:disabled) {
  background: var(--danger-hover);
}
.btn-sm {
  padding: 3px 8px;
  font-size: 11px;
}

/* 旋转动画 */
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 确认弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 24px;
  width: 340px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.modal-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.text-warning {
  color: var(--warning);
}
.modal-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
}
.modal-body {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 4px;
}
.modal-sub {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 20px;
}
.modal-body strong,
.modal-sub strong {
  color: var(--text-primary);
}
.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.modal-actions .btn {
  flex: 1;
  justify-content: center;
}
</style>
