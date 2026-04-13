import { ref, onMounted, toRaw } from 'vue'
import type { PaperItem } from '@/types'

// 数据库配置
const DB_NAME = 'calc-paper'      // 数据库名称
const STORE_NAME = 'papers'       // 存储表名称
const DB_VERSION = 1              // 数据库版本

/**
 * 稿纸数据库类
 * 封装 IndexedDB 操作，提供增删改查方法
 */
class PaperDB {
  private db: IDBDatabase | null = null

  /**
   * 初始化数据库
   * 如果数据库不存在，会自动创建
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      // 数据库升级时创建表结构
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建稿纸存储表
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          // 创建索引，方便按时间排序查询
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
      }
    })
  }

  /**
   * 获取所有稿纸
   */
  async getAll(): Promise<PaperItem[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 根据ID获取单个稿纸
   */
  async get(id: string): Promise<PaperItem | undefined> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 添加新稿纸
   */
  async add(item: PaperItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 更新稿纸
   */
  async update(item: PaperItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 删除稿纸
   */
  async delete(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 清空所有稿纸
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

/**
 * 稿纸数据库操作 Hook
 * 提供稿纸的增删改查、导入导出等功能
 */
export function usePaperDB() {
  const db = new PaperDB()
  const papers = ref<PaperItem[]>([])  // 稿纸列表
  const isLoading = ref(true)           // 加载状态

  /**
   * 加载所有稿纸
   * 按更新时间倒序排列
   */
  const loadPapers = async () => {
    try {
      const allPapers = await db.getAll()
      // 按更新时间排序，最新的在前
      papers.value = allPapers.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (error) {
      console.error('加载稿纸失败:', error)
    }
  }

  /**
   * 将响应式对象转换为普通对象
   * IndexedDB 不能直接存储 Vue 响应式对象
   */
  // 统一转成普通对象，避免把 Vue 响应式代理直接写入 IndexedDB
  const normalizeItem = (item: PaperItem): PaperItem => {
    const raw = toRaw(item) as PaperItem
    return {
      id: raw.id,
      name: raw.name,
      content: raw.content,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    }
  }

  /**
   * 创建新稿纸
   * @param name 稿纸名称，默认为"新稿纸"
   */
  const createPaper = async (name: string = '新稿纸'): Promise<PaperItem> => {
    const now = Date.now()
    const newPaper: PaperItem = {
      id: now.toString(),      // 使用时间戳作为ID
      name,
      content: '',             // 初始内容为空
      createdAt: now,
      updatedAt: now
    }

    try {
      await db.add(newPaper)
      await loadPapers()
      return newPaper
    } catch (error) {
      console.error('创建稿纸失败:', error)
      throw error
    }
  }

  /**
   * 保存稿纸
   * 更新内容和更新时间
   */
  const savePaper = async (item: PaperItem) => {
    try {
      const cleanItem = normalizeItem(item)
      cleanItem.updatedAt = Date.now()
      await db.update(cleanItem)
      await loadPapers()
    } catch (error) {
      console.error('保存稿纸失败:', error)
      throw error
    }
  }

  /**
   * 删除稿纸
   */
  const deletePaper = async (id: string) => {
    try {
      await db.delete(id)
      await loadPapers()
    } catch (error) {
      console.error('删除稿纸失败:', error)
      throw error
    }
  }

  /**
   * 重命名稿纸
   */
  const renamePaper = async (id: string, newName: string) => {
    try {
      const paper = await db.get(id)
      if (paper) {
        paper.name = newName
        paper.updatedAt = Date.now()
        await db.update(paper)
        await loadPapers()
      }
    } catch (error) {
      console.error('重命名稿纸失败:', error)
      throw error
    }
  }

  /**
   * 获取单个稿纸
   */
  const getPaper = async (id: string): Promise<PaperItem | undefined> => {
    try {
      return await db.get(id)
    } catch (error) {
      console.error('获取稿纸失败:', error)
      return undefined
    }
  }

  /**
   * 导出稿纸为JSON字符串
   * @param paperIds 指定要导出的稿纸ID，不传则导出全部
   */
  const exportPapers = async (paperIds?: string[]): Promise<string> => {
    // 筛选要导出的稿纸
    const papersToExport = paperIds
      ? papers.value.filter((p) => paperIds.includes(p.id))
      : papers.value

    // 构建导出数据结构
    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      papers: papersToExport.map(normalizeItem)
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 从JSON字符串导入稿纸
   * @param jsonData JSON格式的稿纸数据
   * @returns 成功导入的数量
   */
  const importPapers = async (jsonData: string): Promise<number> => {
    try {
      const data = JSON.parse(jsonData)
      // 验证数据格式
      if (!data.papers || !Array.isArray(data.papers)) {
        throw new Error('无效的导入数据格式')
      }

      let importedCount = 0
      // 逐个导入稿纸
      for (const paper of data.papers) {
        // 导入时使用新 ID，避免与本地已有稿纸主键冲突
        const newPaper: PaperItem = {
          // 生成新的ID，避免冲突
          id: Date.now().toString() + '_' + importedCount,
          name: paper.name || '导入的稿纸',
          content: paper.content || '',
          createdAt: paper.createdAt || Date.now(),
          updatedAt: Date.now()
        }
        await db.add(newPaper)
        importedCount++
      }

      await loadPapers()
      return importedCount
    } catch (error) {
      console.error('导入稿纸失败:', error)
      throw error
    }
  }

  // 组件挂载时初始化数据库并加载数据
  onMounted(async () => {
    try {
      await db.init()
      await loadPapers()
    } catch (error) {
      console.error('初始化数据库失败:', error)
    } finally {
      isLoading.value = false
    }
  })

  // 导出所有方法
  return {
    papers,        // 稿纸列表
    isLoading,     // 加载状态
    createPaper,   // 创建稿纸
    savePaper,     // 保存稿纸
    deletePaper,   // 删除稿纸
    renamePaper,   // 重命名稿纸
    getPaper,      // 获取稿纸
    exportPapers,  // 导出稿纸
    importPapers,  // 导入稿纸
    loadPapers     // 重新加载稿纸列表
  }
}
