/* eslint-disable max-len */
/* eslint-disable max-statements */
import { performance } from 'perf_hooks'
import { promises } from 'fs'
import { Storage } from '../../storage'
import { clearMockFiles, mockFiles } from '../test-utils/mock-files'

describe('Storage test case', () => {
  beforeEach(() => {
    mockFiles()
  })

  afterEach(() => {
    clearMockFiles()
  })

  describe('Init test case', () => {
    test('Should init the storage propertly', async () => {
      const t10 = performance.now()
      const file21 = await promises.readFile('data/sub-dir/sub-sub-dir/sub-sub-sub-dir/deeply-nested-file.txt')
      const t11 = performance.now()
      expect(file21.toString()).toBe('this file is nested very deep')

      const t1 = performance.now()
      const storage = new Storage()
      const t2 = performance.now()
      await storage.init()
      const t3 = performance.now()
      expect(storage.fileTable.size).toBeGreaterThan(0)
      const t4 = performance.now()
      const file1 = storage.getFile('sub-dir/nested.txt')
      const t5 = performance.now()
      expect(file1.toString()).toBe('this is nested file')

      const t6 = performance.now()
      const file2 = storage.getFile('sub-dir/sub-sub-dir/sub-sub-sub-dir/deeply-nested-file.txt')
      const t7 = performance.now()
      expect(file2).toEqual(file21)
      expect(file2.toString()).toBe('this file is nested very deep')

      const t8 = performance.now()
      const file3 = storage.getFile('sub-dir/sub-sub-dir/very-nested-file2.txt')
      const t9 = performance.now()
      expect(file3.toString()).toBe('this file is nested... realy')

      console.log('Creating the storage in', t2 - t1, 'ms')
      console.log('Initing the storage in', t3 - t2, 'ms')
      console.log('Reading the file1 from the storage in', t5 - t4, 'ms')
      console.log('Reading the file2 from the storage in', t7 - t6, 'ms')
      console.log('Reading the file3 from the storage in', t9 - t8, 'ms')
      console.log('Reading the file21 from the storage in', t11 - t10, 'ms')
    })
  })

  describe('deleteFile test case', () => {
    test('Should delete the file from the storage propertly', async () => {
      const testPath = 'sub-dir/nested.txt'
      const storage = new Storage()
      await storage.init()
      const sizeBefore = storage.currentSize
      const t1 = performance.now()
      await storage.deleteFile(testPath)
      const t2 = performance.now()
      const sizeAfter = storage.currentSize
      expect(sizeBefore).toBeGreaterThan(sizeAfter)
      try {
        storage.getFile(testPath)
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
      }
      console.log('File has deleted propertly in', t2 - t1, 'ms')
    })
  })
})
