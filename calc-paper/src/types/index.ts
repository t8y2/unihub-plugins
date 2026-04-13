/**
 * 稿纸条目数据结构
 */
export interface PaperItem {
  id: string                  // 唯一标识符
  name: string                // 稿纸名称
  content: string             // 计算内容（多行表达式）
  createdAt: number           // 创建时间戳
  updatedAt: number           // 更新时间戳
}

/**
 * 计算行数据结构
 * 用于显示每一行的表达式和计算结果
 */
export interface CalcLine {
  lineNumber: number          // 行号
  expression: string          // 表达式内容
  result: string | null       // 计算结果
  error: string | null        // 错误信息
}

/**
 * 导出数据格式
 * 用于稿纸的导入导出
 */
export interface ExportData {
  version: string             // 数据版本号
  exportedAt: number          // 导出时间戳
  papers: PaperItem[]         // 稿纸列表
}

/**
 * UniHub 插件 API 接口
 * 提供剪贴板、存储、对话框等功能
 */
export interface UnihubAPI {
  clipboard: {
    writeText: (text: string) => Promise<void>   // 写入文本到剪贴板
    readText: () => Promise<string>              // 从剪贴板读取文本
  }
  storage: {
    get: <T>(key: string) => Promise<T | null>   // 获取存储数据
    set: (key: string, value: unknown) => Promise<void>  // 存储数据
    delete: (key: string) => Promise<void>       // 删除存储数据
  }
  dialog: {
    showSaveDialog: (options: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }) => Promise<{ canceled: boolean; filePath?: string }>
    showOpenDialog: (options: {
      title?: string
      filters?: Array<{ name: string; extensions: string[] }>
      properties?: string[]
    }) => Promise<{ canceled: boolean; filePaths: string[] }>
  }
}

// 声明全局 window 对象上的 UniHub API
declare global {
  interface Window {
    unihub: UnihubAPI
    __UNIHUB_PLUGIN_ID__?: string
  }
}
