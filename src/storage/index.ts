import { promises } from 'fs'
import {
  resolve, join, sep, relative
} from 'path'
import { getFilesPath, formFileObj } from './lib'

export interface StorageConfig {
  rootPath?: string
  size?: number,
  sharedBuffer?: SharedArrayBuffer
}

interface FileMap {
  start: number
  end: number
}

interface FileMapWithKey {
  start: number
  end: number
  key: string
}

const DEFAULT_BUFFER_SIZE: number = 1024 * 1024 * 50
const DEFAULT_STORAGE_PATH: string = join(resolve(), 'data')
const ERROR_STORAGE_BUSY: Error = new Error('The storage is busy')
const ERROR_STORAGE_FULL: Error = new Error('The storage is full')
const ERROR_FILE_NOT_FOUND: Error = new Error('The file not found')

export class Storage {
  rootPath: string

  sharedBuffer: SharedArrayBuffer

  buffer: Buffer

  fileTable: Map<string, FileMap>

  currentSize: number

  capacity: number

  isBusy: boolean

  constructor (config?: StorageConfig) {
    this.rootPath = config?.rootPath || DEFAULT_STORAGE_PATH
    this.capacity = config?.size || DEFAULT_BUFFER_SIZE
    this.sharedBuffer = config?.sharedBuffer || new SharedArrayBuffer(this.capacity)
    this.buffer = Buffer.from(this.sharedBuffer)
    this.fileTable = new Map()
    this.currentSize = 0
    this.isBusy = false
  }

  async init (): Promise<void> {
    if (this.currentSize) {
      this.clear()
    }
    const pathes = await getFilesPath(this.rootPath)
    const keysObj = pathes
      .map(el => relative(this.rootPath, el))
      .map(el => el.split(sep).join('/'))
      .map((el, index) => ({ relativePath: el, absolutePath: pathes[index] }))
    const fileObj = await Promise.all(keysObj.map(formFileObj))

    fileObj.forEach(({ file, relativePath }) => {
      if (this.buffer.length <= this.currentSize + file.length) {
        this.isBusy = false
        throw ERROR_STORAGE_FULL
      }
      file.copy(this.buffer, this.currentSize, 0, file.length)
      this.fileTable.set(relativePath, {
        start: this.currentSize,
        end: this.currentSize + file.length
      })
      this.currentSize += file.length
    })
  }

  getFile (path: string): Buffer {
    if (this.isBusy) {
      throw ERROR_STORAGE_BUSY
    }
    const keyObj = this.fileTable.get(path)
    if (!keyObj) {
      throw new Error('File not found')
    }
    const file = this.buffer.slice(keyObj.start, keyObj.end) /* Atomics.load(this.buffer, ) */
    return file
  }

  async deleteFile (path: string): Promise<void> {
    if (this.isBusy) {
      throw ERROR_STORAGE_BUSY
    }
    this.isBusy = true
    const existedkeyObj = this.fileTable.get(path)
    if (!existedkeyObj) {
      this.isBusy = false
      throw ERROR_FILE_NOT_FOUND
    }
    let filesAfter: Array<FileMapWithKey> = []
    this.fileTable.forEach((keyObj, key) => {
      if (keyObj.start >= existedkeyObj.end) {
        filesAfter.push({ ...keyObj, key })
      }
    })
    filesAfter = filesAfter.sort((a, b) => a.start - b.start)
    let offset = existedkeyObj.start
    filesAfter.forEach(keyObj => {
      const file = this.buffer.slice(keyObj.start, keyObj.end)
      file.copy(this.buffer, offset, 0, file.length)
      this.fileTable.set(keyObj.key, { start: offset, end: offset + file.length })
      offset += file.length
    })
    this.fileTable.delete(path)
    this.currentSize = offset
    this.isBusy = false
    await promises.rm(join(this.rootPath, path))
  }

  clear (): void {
    if (this.isBusy) {
      throw ERROR_STORAGE_BUSY
    }
    this.currentSize = 0
    this.buffer = Buffer.alloc(this.capacity)
  }

  async addFile (path: string, file: Buffer): Promise<void> {
    if (this.isBusy) {
      throw ERROR_STORAGE_BUSY
    }
    this.isBusy = true
    const existedFile = this.getFile(path)
    if (existedFile) {
      this.isBusy = false
      throw new Error('File already exists')
    }
    if (this.buffer.length <= this.currentSize + file.length) {
      this.isBusy = false
      throw ERROR_STORAGE_FULL
    }
    file.copy(this.buffer, this.currentSize, 0, file.length)
    this.fileTable.set(path, { start: this.currentSize, end: this.currentSize + file.length })
    this.currentSize += file.length
    this.isBusy = false
    await promises.writeFile(join(this.rootPath, path), file)
  }
}
