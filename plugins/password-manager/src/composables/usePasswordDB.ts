import { ref, onMounted } from 'vue'

export interface PasswordEntry {
  id: string
  title: string
  username: string
  password: string
  url?: string
  category: string
  notes?: string
  createdAt: number
  updatedAt: number
  isFavorite?: boolean
}

const STORAGE_KEY_PREFIX = 'password-manager:'
const SALT_KEY = `${STORAGE_KEY_PREFIX}salt`
const VERIFICATION_KEY = `${STORAGE_KEY_PREFIX}verification`
const ENTRIES_KEY = `${STORAGE_KEY_PREFIX}entries`

// 简单的加密/解密函数（使用 Web Crypto API）
class CryptoService {
  private key: CryptoKey | null = null

  async deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterPassword),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  async setMasterPassword(password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    this.key = await this.deriveKey(password, salt)
    
    // 保存 salt 到 unihub.db
    await window.unihub.db.set(SALT_KEY, Array.from(salt).join(','))
    
    // 创建一个验证令牌来验证密码是否正确
    const verificationToken = await this.encrypt('VERIFICATION_TOKEN')
    await window.unihub.db.set(VERIFICATION_KEY, verificationToken)
  }

  async unlockWithPassword(password: string): Promise<boolean> {
    const saltStr = await window.unihub.db.get(SALT_KEY) as string | undefined
    const verificationToken = await window.unihub.db.get(VERIFICATION_KEY) as string | undefined
    
    if (!saltStr || !verificationToken) return false

    const salt = new Uint8Array(saltStr.split(',').map(Number))
    
    try {
      this.key = await this.deriveKey(password, salt)
      
      // 尝试解密验证令牌来验证密码是否正确
      const decrypted = await this.decrypt(verificationToken)
      
      if (decrypted === 'VERIFICATION_TOKEN') {
        return true
      } else {
        this.key = null
        return false
      }
    } catch {
      this.key = null
      return false
    }
  }

  async encrypt(text: string): Promise<string> {
    if (!this.key) throw new Error('未设置主密码')

    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    )

    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return btoa(String.fromCharCode(...combined))
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) throw new Error('未设置主密码')

    const combined = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  }

  isUnlocked(): boolean {
    return this.key !== null
  }

  lock(): void {
    this.key = null
  }
}

class PasswordDB {
  private crypto = new CryptoService()

  getCrypto(): CryptoService {
    return this.crypto
  }

  async init(): Promise<void> {
    // unihub.db 不需要初始化
  }

  async getAll(): Promise<PasswordEntry[]> {
    const data = await window.unihub.db.get(ENTRIES_KEY) as PasswordEntry[] | undefined
    return data || []
  }

  async saveAll(entries: PasswordEntry[]): Promise<void> {
    await window.unihub.db.set(ENTRIES_KEY, entries)
  }

  async add(entry: PasswordEntry): Promise<void> {
    // 加密敏感字段
    const encrypted = {
      ...entry,
      password: await this.crypto.encrypt(entry.password),
      username: await this.crypto.encrypt(entry.username),
      notes: entry.notes ? await this.crypto.encrypt(entry.notes) : undefined
    }

    const entries = await this.getAll()
    entries.push(encrypted)
    await this.saveAll(entries)
  }

  async update(entry: PasswordEntry): Promise<void> {
    // 加密敏感字段
    const encrypted = {
      ...entry,
      password: await this.crypto.encrypt(entry.password),
      username: await this.crypto.encrypt(entry.username),
      notes: entry.notes ? await this.crypto.encrypt(entry.notes) : undefined
    }

    const entries = await this.getAll()
    const index = entries.findIndex((e) => e.id === entry.id)
    if (index !== -1) {
      entries[index] = encrypted
      await this.saveAll(entries)
    }
  }

  async delete(id: string): Promise<void> {
    const entries = await this.getAll()
    const filtered = entries.filter((e) => e.id !== id)
    await this.saveAll(filtered)
  }

  async decryptEntry(entry: PasswordEntry): Promise<PasswordEntry> {
    return {
      ...entry,
      password: await this.crypto.decrypt(entry.password),
      username: await this.crypto.decrypt(entry.username),
      notes: entry.notes ? await this.crypto.decrypt(entry.notes) : undefined
    }
  }
}

export function usePasswordDB() {
  const db = new PasswordDB()
  const entries = ref<PasswordEntry[]>([])
  const isLoading = ref(true)
  const isUnlocked = ref(false)
  const hasSetup = ref(false)

  const checkSetup = async () => {
    const salt = await window.unihub.db.get(SALT_KEY)
    hasSetup.value = !!salt
  }

  const setupMasterPassword = async (password: string) => {
    await db.getCrypto().setMasterPassword(password)
    hasSetup.value = true
    isUnlocked.value = true
  }

  const unlock = async (password: string): Promise<boolean> => {
    const success = await db.getCrypto().unlockWithPassword(password)
    if (success) {
      isUnlocked.value = true
      await loadEntries()
    }
    return success
  }

  const lock = () => {
    db.getCrypto().lock()
    isUnlocked.value = false
    entries.value = []
  }

  const loadEntries = async () => {
    if (!isUnlocked.value) return

    try {
      const encrypted = await db.getAll()
      entries.value = await Promise.all(encrypted.map((e) => db.decryptEntry(e)))
      entries.value.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (error) {
      console.error('加载密码失败:', error)
    }
  }

  const addEntry = async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now()
    const newEntry: PasswordEntry = {
      ...entry,
      id: now.toString(),
      createdAt: now,
      updatedAt: now
    }

    try {
      await db.add(newEntry)
      await loadEntries()
    } catch (error) {
      console.error('添加密码失败:', error)
      throw error
    }
  }

  const updateEntry = async (entry: PasswordEntry) => {
    try {
      const updated = { ...entry, updatedAt: Date.now() }
      await db.update(updated)
      await loadEntries()
    } catch (error) {
      console.error('更新密码失败:', error)
      throw error
    }
  }

  const deleteEntry = async (id: string) => {
    try {
      await db.delete(id)
      await loadEntries()
    } catch (error) {
      console.error('删除密码失败:', error)
      throw error
    }
  }

  const toggleFavorite = async (entry: PasswordEntry) => {
    await updateEntry({ ...entry, isFavorite: !entry.isFavorite })
  }

  onMounted(async () => {
    try {
      await db.init()
      await checkSetup()
    } catch (error) {
      console.error('初始化数据库失败:', error)
    } finally {
      isLoading.value = false
    }
  })

  return {
    entries,
    isLoading,
    isUnlocked,
    hasSetup,
    setupMasterPassword,
    unlock,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    loadEntries
  }
}
