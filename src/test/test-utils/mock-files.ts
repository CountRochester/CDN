import { writeFileSync, rmSync } from 'fs'
import { resolve, join } from 'path'

export const files = [
  {
    path: 'data',
    name: 'test-data.json',
    content: `
      {
        "data": {
          "arr": [
            "test1",
            "test2"
          ]
        }
      }
    `
  },
  {
    path: 'data/sub-dir',
    name: 'nested.txt',
    content: 'this is nested file'
  },
  {
    path: 'data/sub-dir/sub-sub-dir',
    name: 'very-nested-file1.txt',
    content: 'this file is nested'
  },
  {
    path: 'data/sub-dir/sub-sub-dir',
    name: 'very-nested-file2.txt',
    content: 'this file is nested... really'
  },
  {
    path: 'data/sub-dir/sub-sub-dir/sub-sub-sub-dir',
    name: 'deeply-nested-file.txt',
    content: 'this file is nested very deep'
  },
]

const rootPath = resolve()

export function clearMockFiles (): void {
  files.forEach(file => {
    const filePath = join(rootPath, file.path, file.name)
    try {
      rmSync(filePath)
    } catch (err) {
      console.log(`File ${file.name} already deleted`)
    }
  })
}

export function mockFiles (): void {
  files.forEach(file => {
    const filePath = join(rootPath, file.path, file.name)
    writeFileSync(filePath, file.content)
  })
}
