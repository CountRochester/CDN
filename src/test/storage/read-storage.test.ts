/* eslint-disable max-statements */
import { ReadStorage, ReadStorageOptions } from '@/storage/read-storage'
import { AsyncQueue } from '@/async-queue'
import { MemoryMap } from '@/memory-map'
import { mockFiles, clearMockFiles } from '@t/test-utils/mock-files'
import { readFilesFromPath } from '@/storage/lib'
import { performance } from 'perf_hooks'

// jest.setTimeout(15000)

describe('constructor test case', () => {
  test('should return the proper object', async () => {
    mockFiles()
    const bufferSize = 1024 * 1024 * 50
    const files = await readFilesFromPath('data')
    const filesToInit = files.map(fileObj => ({
      path: fileObj.relativePath,
      content: fileObj.file
    }))
    const size = files.reduce((acc, el) => acc + el.file.length, 0)
    const sharedMemory = new SharedArrayBuffer(bufferSize * 2)
    const options: ReadStorageOptions = {
      queue: new AsyncQueue({ timeout: 5000 }),
      memoryMap: new MemoryMap({ capacity: bufferSize, files: filesToInit }),
      sharedBuffer: sharedMemory
    }
    const storage = new ReadStorage(options)
    expect(storage.capacity).toBe(bufferSize)
    expect(storage.currentSize).toBe(size)
    expect(storage.filesCount).toBe(files.length)
    expect(storage.isEmpty).toBe(false)
    clearMockFiles()
  })
})

describe('readFile test case', () => {
  test('should returns the content of the file', async () => {
    mockFiles()
    const bufferSize = 1024 * 1024 * 50
    const files = await readFilesFromPath('data')
    const filesToInit = files.map(fileObj => ({
      path: fileObj.relativePath,
      content: fileObj.file
    }))
    const sharedMemory = new SharedArrayBuffer(bufferSize * 2)
    const buffer = Buffer.from(sharedMemory)
    let currentSize = 0
    files.forEach(({ file }) => {
      file.copy(buffer, currentSize, 0, file.length)
      currentSize += file.length
    })

    const queue = new AsyncQueue<Buffer>({ timeout: 5000 })

    const options: ReadStorageOptions = {
      queue,
      memoryMap: new MemoryMap({ capacity: bufferSize, files: filesToInit }),
      sharedBuffer: sharedMemory
    }
    const storage = new ReadStorage(options)
    const fileToTest = files[2]
    const t1 = performance.now()
    const result = await storage.readFile(fileToTest.relativePath)
    const t2 = performance.now()
    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString()).toBe(fileToTest.file.toString())
    expect(queue.isEmpty).toBe(true)
    await storage.destroy()
    clearMockFiles()
    console.log('File readed in', t2 - t1, 'ms')
  })

  test('should returns the content of the file (multiple)', async () => {
    mockFiles()
    const bufferSize = 1024 * 1024 * 50
    const files = await readFilesFromPath('data')
    const filesToInit = files.map(fileObj => ({
      path: fileObj.relativePath,
      content: fileObj.file
    }))
    const sharedMemory = new SharedArrayBuffer(bufferSize * 2)
    const buffer = Buffer.from(sharedMemory)
    let currentSize = 0
    files.forEach(({ file }) => {
      file.copy(buffer, currentSize, 0, file.length)
      currentSize += file.length
    })

    const queue = new AsyncQueue<Buffer>({ timeout: 5000 })

    const options: ReadStorageOptions = {
      queue,
      memoryMap: new MemoryMap({ capacity: bufferSize, files: filesToInit }),
      sharedBuffer: sharedMemory
    }

    const storage = new ReadStorage(options)
    const t1 = performance.now()
    const result = await Promise.all(files.map(el => storage.readFile(el.relativePath)))
    const t2 = performance.now()
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBe(files.length)
    expect(queue.isEmpty).toBe(true)
    await storage.destroy()
    clearMockFiles()
    console.log('Files readed in', t2 - t1, 'ms')
  })
})
