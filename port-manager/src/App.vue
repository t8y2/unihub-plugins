<template>
  <div class="app-container">
    <!-- 头部 -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="header-title">端口管理器</h1>
        <span v-if="!loading" class="port-count"
          >{{ filteredPorts.length }} 个端口</span
        >
      </div>
      <button
        class="icon-btn"
        :disabled="loading"
        title="刷新"
        @click="refresh"
      >
        <RefreshCw :size="14" :class="{ spinning: loading }" />
      </button>
    </header>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <div class="search-wrapper">
        <Search :size="13" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索端口号、进程名或 PID..."
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="searchQuery = ''"
        >
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
    <div class="content-area">
      <!-- 加载中 -->
      <div v-if="loading" class="state-empty">
        <Loader2 :size="26" class="spinning state-icon-accent" />
        <p>正在获取端口信息...</p>
      </div>

      <!-- 出错 -->
      <div v-else-if="error" class="state-empty state-error">
        <AlertCircle :size="26" />
        <p>{{ error }}</p>
        <button class="btn-primary" @click="refresh">重试</button>
      </div>

      <!-- 无结果 -->
      <div v-else-if="filteredPorts.length === 0" class="state-empty">
        <Unplug :size="26" />
        <p>没有找到匹配的端口</p>
      </div>

      <!-- 表格 -->
      <div v-else class="table-wrap">
        <table class="port-table">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.field"
                :class="{ sortable: col.sortable }"
                @click="
                  col.sortable ? sortBy(col.field as SortField) : undefined
                "
              >
                {{ col.label }}
                <template v-if="col.sortable">
                  <ChevronUp
                    v-if="sortField === col.field && sortDir === 'asc'"
                    :size="11"
                    class="sort-indicator active"
                  />
                  <ChevronDown
                    v-else-if="sortField === col.field && sortDir === 'desc'"
                    :size="11"
                    class="sort-indicator active"
                  />
                  <ChevronsUpDown v-else :size="11" class="sort-indicator" />
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in sortedPorts"
              :key="`${p.pid}-${p.port}-${p.protocol}`"
            >
              <td class="col-port">{{ p.port }}</td>
              <td>
                <span class="protocol-tag" :class="p.protocol.toLowerCase()">{{
                  p.protocol
                }}</span>
              </td>
              <td class="col-name" :title="p.name">{{ p.name || "—" }}</td>
              <td class="col-pid">{{ p.pid }}</td>
              <td class="col-addr">{{ p.address || "—" }}</td>
              <td>
                <button
                  class="btn-kill"
                  :disabled="killing === p.pid"
                  @click="confirmKill(p)"
                >
                  <Loader2
                    v-if="killing === p.pid"
                    :size="11"
                    class="spinning"
                  />
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
        class="modal-overlay"
        @click.self="confirmTarget = null"
      >
        <div class="modal-card">
          <div class="modal-icon-wrap">
            <AlertTriangle :size="24" class="modal-warn-icon" />
          </div>
          <h2 class="modal-title">关闭进程</h2>
          <p class="modal-desc">
            确定要关闭进程
            <strong>{{ confirmTarget.name || "Unknown" }}</strong>
            (PID: {{ confirmTarget.pid }}) 吗？
          </p>
          <p class="modal-sub">
            该进程正在占用端口 <strong>{{ confirmTarget.port }}</strong>
          </p>
          <div class="modal-actions">
            <button class="btn-cancel" @click="confirmTarget = null">
              取消
            </button>
            <button class="btn-danger" @click="doKill">确认关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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

const ports = ref<PortInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const killing = ref<number | null>(null);
const confirmTarget = ref<PortInfo | null>(null);

const searchQuery = ref("");
const protocolFilter = ref<"ALL" | "TCP" | "UDP">("ALL");
const sortField = ref<SortField>("port");
const sortDir = ref<SortDir>("asc");

const protocolTabs: { label: string; value: "ALL" | "TCP" | "UDP" }[] = [
  { label: "全部", value: "ALL" },
  { label: "TCP", value: "TCP" },
  { label: "UDP", value: "UDP" },
];

const columns: { label: string; field: string; sortable: boolean }[] = [
  { label: "端口", field: "port", sortable: true },
  { label: "协议", field: "protocol", sortable: true },
  { label: "进程名", field: "name", sortable: true },
  { label: "PID", field: "pid", sortable: true },
  { label: "地址", field: "address", sortable: false },
  { label: "操作", field: "action", sortable: false },
];

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
    const va = a[sortField.value as keyof PortInfo];
    const vb = b[sortField.value as keyof PortInfo];
    if (typeof va === "number" && typeof vb === "number")
      return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
});

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
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* ---- Header ---- */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
}
.port-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 1px 8px;
  border-radius: 99px;
}
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.icon-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Filter Bar ---- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}
.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 180px;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 6px 28px 6px 28px;
  font-size: 13px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-input:focus {
  border-color: var(--accent);
}
.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  transition: color 0.15s;
}
.search-clear:hover {
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
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  border-right: 1px solid var(--border-color);
}
.tab-btn:last-child {
  border-right: none;
}
.tab-btn:hover:not(.active) {
  background: var(--bg-secondary);
}
.tab-btn.active {
  background: var(--accent);
  color: #fff;
}

/* ---- Content ---- */
.content-area {
  flex: 1;
  overflow: auto;
}
.state-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 64px 16px;
  color: var(--text-muted);
  font-size: 14px;
}
.state-empty p {
  margin: 0;
}
.state-error {
  color: var(--danger);
}
.state-icon-accent {
  color: var(--accent);
}

/* ---- Table ---- */
.table-wrap {
  overflow-x: auto;
}
.port-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}
.port-table thead tr {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}
.port-table th {
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-color);
  user-select: none;
}
.port-table th.sortable {
  cursor: pointer;
}
.port-table th.sortable:hover {
  color: var(--text-primary);
}
.sort-indicator {
  display: inline;
  margin-left: 2px;
  opacity: 0.35;
  vertical-align: middle;
}
.sort-indicator.active {
  opacity: 1;
  color: var(--accent);
}
.port-table tbody tr {
  border-bottom: 1px solid var(--border-color);
  transition: background 0.1s;
}
.port-table tbody tr:last-child {
  border-bottom: none;
}
.port-table tbody tr:hover {
  background: var(--row-hover);
}
.port-table td {
  padding: 8px 12px;
}
.col-port {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.col-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.col-pid {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.col-addr {
  font-size: 12px;
  color: var(--text-primary);
}

/* ---- Protocol Tag ---- */
.protocol-tag {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  letter-spacing: 0.03em;
  border: 1px solid;
}
.protocol-tag.tcp {
  background: var(--tag-tcp-bg);
  color: var(--tag-tcp-text);
  border-color: var(--tag-tcp-border);
}
.protocol-tag.udp {
  background: var(--tag-udp-bg);
  color: var(--tag-udp-text);
  border-color: var(--tag-udp-border);
}

/* ---- Buttons ---- */
.btn-primary {
  margin-top: 4px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: var(--accent-hover);
}
.btn-kill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--danger);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-kill:hover {
  background: var(--danger-hover);
}
.btn-kill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}
.modal-card {
  width: 320px;
  max-width: calc(100vw - 2rem);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-modal);
  padding: 24px;
}
.modal-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.modal-warn-icon {
  color: var(--warning);
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  margin: 0 0 8px;
}
.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin: 0 0 4px;
}
.modal-desc strong {
  color: var(--text-primary);
}
.modal-sub {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin: 0 0 20px;
}
.modal-sub strong {
  color: var(--text-secondary);
}
.modal-actions {
  display: flex;
  gap: 8px;
}
.btn-cancel {
  flex: 1;
  padding: 7px 0;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.btn-cancel:hover {
  background: var(--bg-secondary);
}
.btn-danger {
  flex: 1;
  padding: 7px 0;
  font-size: 13px;
  font-weight: 500;
  background: var(--danger);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover {
  background: var(--danger-hover);
}

/* ---- Animations ---- */
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
