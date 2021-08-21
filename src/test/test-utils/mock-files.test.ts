import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import { mockFiles, files, clearMockFiles } from './mock-files'

describe('clearMockFiles test case', () => {
  test('Should create files', () => {
    mockFiles()
    clearMockFiles()
    const rootPath = resolve('')
    files.forEach(file => {
      const filePath = join(rootPath, file.path, file.name)
      try {
        readFileSync(filePath)
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(err.code).toBeDefined()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(err.code).toBe('ENOENT')
      }
    })
  })
})

describe('mockFiles test case', () => {
  test('Should create files', () => {
    clearMockFiles()
    mockFiles()
    const rootPath = resolve('')
    files.forEach(file => {
      const filePath = join(rootPath, file.path, file.name)
      const fileContent = readFileSync(filePath)
      expect(fileContent.toString()).toBe(file.content)
    })
  })
})
