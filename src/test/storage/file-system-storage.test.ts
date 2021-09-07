/* eslint-disable max-nested-callbacks */
import { resolve, join } from 'path'
import { writeFileSync, unlinkSync, readFileSync } from 'fs'
import { FileSystemStorage, eventHandlers } from '@/storage/file-system-storage'
import { mockFiles, clearMockFiles } from '@t/test-utils/mock-files'
import { timeout } from '@/common/helpers'

jest.setTimeout(20000)

describe('Watch dirrectory test case', () => {
  test('should propertly start watching', async () => {
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
