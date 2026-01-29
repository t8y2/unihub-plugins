declare global {
  interface Window {
    unihub: {
      clipboard: {
        readText: () => Promise<string>
        writeText: (text: string) => Promise<void>
        readImage: () => Promise<string>
        writeImage: (dataUrl: string) => Promise<void>
        subscribe: () => Promise<void>
        unsubscribe: () => Promise<void>
        onChange: (callback: (data: { content: string }) => void) => () => void
      }
      db: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
        clear: () => Promise<void>
        keys: () => Promise<string[]>
      }
      system: {
        quickPaste: (options: { delayMs: number; hideWindow: boolean }) => Promise<void>
      }
    }
    electron?: {
      ipcRenderer: {
        send: (channel: string, ...args: unknown[]) => void
        on: (channel: string, listener: (...args: unknown[]) => void) => void
        removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
      }
    }
  }
}

export {}
