/* eslint-disable max-statements */
/* eslint-disable max-nested-callbacks */
import { resolve, join } from 'path'
import {
  writeFileSync, unlinkSync, readFileSync, promises, constants
} from 'fs'
import { EventEmitter } from 'events'
import { Emitter } from '@/common/emitter'
import { FileSystemStorage, eventHandlers, makeDir } from '@/storage/file-system-storage'
import { mockFiles, clearMockFiles } from '@t/test-utils/mock-files'
import { timeout } from '@/common/helpers'

jest.setTimeout(20000)

describe('Watch directory test case', () => {
  test('should properly start watching', async () => {
    const storage = new FileSystemStorage({ rootPath: 'data' })
    storage.watch()

    mockFiles()
    await timeout(2000)
    clearMockFiles()
    await timeout(2000)
    storage.destroy()
  })
})

describe('Event handlers test case', () => {
  describe('rename test case', () => {
    test('should emit delete if file is deleted', () => {
      const rootPath = join(resolve(''), 'data')
      const relativePath = 'delete-test.json'
      const emitSpy = jest.fn()

      eventHandlers.rename(relativePath, rootPath, emitSpy, () => {
        expect(emitSpy).toBeCalledWith('delete', { relativePath })
      })
    })

    test('should emit new if file is created', async () => {
      const rootPath = join(resolve(''), 'data')
      const relativePath = 'delete-test.txt'
      const emitSpy = jest.fn()

      const filePath = join(rootPath, relativePath)

      writeFileSync(filePath, 'test')
      const file = readFileSync(filePath)

      await new Promise<void>((promiseResolve, reject) => {
        eventHandlers.rename(relativePath, rootPath, emitSpy, () => {
          try {
            unlinkSync(filePath)
            expect(emitSpy).toBeCalled()
            expect(emitSpy).toBeCalledWith('new', { relativePath, file })
            promiseResolve()
          } catch (err) {
            reject(err)
          }
        })
      })
    })
  })

  describe('change test case', () => {
    test('should emit change if file is changed', async () => {
      const rootPath = join(resolve(''), 'data')
      const relativePath = 'delete-test.txt'
      const emitSpy = jest.fn()

      const filePath = join(rootPath, relativePath)

      writeFileSync(filePath, 'test')
      const file = readFileSync(filePath)

      await new Promise<void>((promiseResolve, reject) => {
        eventHandlers.change(relativePath, rootPath, emitSpy, () => {
          try {
            unlinkSync(filePath)
            expect(emitSpy).toBeCalled()
            expect(emitSpy).toBeCalledWith('change', { relativePath, file })
            promiseResolve()
          } catch (err) {
            reject(err)
          }
        })
      })
    })
  })
})

describe('makeDir test case', () => {
  test('should make dir if it is not exists', async () => {
    const testDirPath = join(resolve(''), 'data', 'test')
    const testPath = join(testDirPath, 'pp')
    try {
      await makeDir(testPath)
      await promises.access(testPath, constants.F_OK)
    } finally {
      await promises.rmdir(testPath)
      await promises.rmdir(testDirPath)
    }
  })

  test('should do nothing if dir is exists', async () => {
    const testDirPath = join(resolve(''), 'data', 'test')
    const testPath = join(testDirPath, 'p4p')
    try {
      await makeDir(testPath)
      await promises.access(testPath, constants.F_OK)
      await makeDir(testPath)
      await promises.access(testPath, constants.F_OK)
    } finally {
      await promises.rmdir(testPath)
      await promises.rmdir(testDirPath)
    }
  })
})

describe('constructor test case', () => {
  test('should returns the proper object', () => {
    const storage = new FileSystemStorage({ rootPath: 'data' })
    expect(storage).toBeInstanceOf(Emitter)
    expect(storage).toBeInstanceOf(EventEmitter)
    expect(storage.rootPath).toBe('data')
    expect(storage.isWatching).toBe(false)
  })
})

describe('getFile test case', () => {
  test('should return the proper output if file exists', async () => {
    const rootPath = join(resolve(''), 'data')
    const dirName = 'test-getFile'
    const fileName = 'test-file.txt'
    const testPath = join(rootPath, dirName)
    const filePath = join(testPath, fileName)
    try {
      const storage = new FileSystemStorage({ rootPath })
      await makeDir(testPath)
      const content = Buffer.from('Test file content')
      writeFileSync(filePath, content)
      const result = await storage.getFile([dirName, fileName].join('/'))

      expect(result.file).toEqual(content)
      expect(result.relativePath).toBe([dirName, fileName].join('/'))
      expect(result.absolutePath).toBe(filePath)
    } finally {
      unlinkSync(filePath)
      await promises.rmdir(testPath)
    }
  })

  test('should throw an error if dir path is provided', async () => {
    const rootPath = join(resolve(''), 'data')
    const storage = new FileSystemStorage({ rootPath })
    const dirName = 'test-getFile'
    const testPath = join(rootPath, dirName)
    await makeDir(testPath)
    try {
      await storage.getFile(dirName)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    } finally {
      await promises.rmdir(testPath)
    }
  })

  test('should throw an error if file not found', async () => {
    const rootPath = join(resolve(''), 'data')
    const storage = new FileSystemStorage({ rootPath })
    const dirName = 'test-getFile'
    const testPath = join(rootPath, dirName)
    await makeDir(testPath)
    try {
      await storage.getFile(`${dirName}ss`)
    } catch (err) {
      expect((err as Error).constructor.name).toBe('Error')
    } finally {
      await promises.rmdir(testPath)
    }
  })
})

describe('readDir test case', () => {
  test('should return the proper output if dir exists', async () => {
    const rootPath = join(resolve(''), 'data')
    const dirName = 'test-readDir5'
    const fileName1 = 'test-file1.txt'
    const fileName2 = 'test-file2.txt'
    const testPath = join(rootPath, dirName)
    const filePath1 = join(testPath, fileName1)
    const filePath2 = join(testPath, fileName2)
    try {
      const storage = new FileSystemStorage({ rootPath })
      await makeDir(testPath)
      const content1 = Buffer.from('Test file 1 content')
      const content2 = Buffer.from('Test file 2 content')
      writeFileSync(filePath1, content1)
      writeFileSync(filePath2, content2)
      const result = await storage.readDir(dirName)

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBe(2)
      expect(result[0].file).toEqual(content1)
      expect(result[1].file).toEqual(content2)
      expect(result[0].relativePath).toBe(join(dirName, fileName1))
      expect(result[1].relativePath).toBe(join(dirName, fileName2))
      expect(result[0].absolutePath).toBe(filePath1)
      expect(result[1].absolutePath).toBe(filePath2)
    } finally {
      unlinkSync(filePath1)
      unlinkSync(filePath2)
      await promises.rmdir(testPath)
    }
  })

  test('should return an empty array if the dir is empty', async () => {
    const rootPath = join(resolve(''), 'data')
    const dirName = 'test-readDir7'
    const testPath = join(rootPath, dirName)
    try {
      const storage = new FileSystemStorage({ rootPath })
      await makeDir(testPath)
      const result = await storage.readDir(dirName)

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBe(0)
    } finally {
      await promises.rmdir(testPath)
    }
  })
})

describe('readAllFiles test case', () => {
  beforeEach(() => {
    mockFiles()
  })
  afterEach(() => {
    clearMockFiles()
  })

  test('should reads all the files in the storage', async () => {
    const rootPath = join(resolve(''), 'data')
    const storage = new FileSystemStorage({ rootPath })
    const result = await storage.readAllFiles()
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBe(5)
  })
})

describe('writeFile test case', () => {
  test('should write the file and return the path', async () => {
    const rootPath = join(resolve(''), 'data')
    const dirName = 'test-getFile'
    const fileName = 'test-file777.txt'
    const testPath = join(rootPath, dirName)
    try {
      const storage = new FileSystemStorage({ rootPath })
      const content = Buffer.from('Test file content')
      const newFilePath = await storage.writeFile([dirName, fileName].join('/'), content)

      expect(typeof newFilePath).toBe('string')

      const fileAfterWrite = await storage.getFile(newFilePath)

      expect(fileAfterWrite.file).toEqual(content)
    } finally {
      await promises.rm(testPath, { recursive: true, force: true })
    }
  })
})
