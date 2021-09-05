import { FileSystemStorage } from '@/storage/file-system-storage'
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
