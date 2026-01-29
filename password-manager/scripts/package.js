import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const output = createWriteStream(join(__dirname, '..', 'plugin.zip'))
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`插件打包完成: ${archive.pointer()} 字节`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)
archive.directory(join(__dirname, '..', 'dist'), 'dist')
archive.file(join(__dirname, '..', 'package.json'), { name: 'package.json' })
archive.finalize()
