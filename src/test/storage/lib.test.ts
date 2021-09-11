import { join, sep } from 'path'
import { getFilesPath } from '@/storage/lib'
import { clearMockFiles, mockFiles } from '@t/test-utils/mock-files'

describe('getFilesPath test case', () => {
  beforeEach(() => {
    mockFiles()
  })

  afterEach(() => {
    clearMockFiles()
  })

  test('Should read path of all nested files', async () => {
    const testPath = 'data'

    const expectedResult = [
      join(testPath, 'test-data.json'),
      join(testPath, 'sub-dir/nested.txt'),
      join(testPath, 'sub-dir/sub-sub-dir/very-nested-file1.txt'),
      join(testPath, 'sub-dir/sub-sub-dir/very-nested-file2.txt'),
      join(testPath, 'sub-dir/sub-sub-dir/sub-sub-sub-dir/deeply-nested-file.txt')
    ]

    const result = await getFilesPath(testPath)
    console.log(result.map(el => el.split(sep).join('/')))

    expect(result).toEqual(expectedResult)
  })
})
