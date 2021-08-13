import { promises } from 'fs'
import { join } from 'path'

interface FileStat {
  path: string
  isDir: boolean
}

interface FileObjectInputInterface {
  key: string
  path: string
}

interface FileObjectOutputInterface {
  key: string
  path: string
  file: Buffer
}

async function isDir (path: string): Promise<boolean> {
  const stats = await promises.lstat(path)
  return stats.isDirectory()
}

async function getFileStat (path: string): Promise<FileStat> {
  const isDirrectory = await isDir(path)
  return {
    path,
    isDir: isDirrectory
  }
}

export async function getFilesPath (root: string): Promise<Array<string>> {
  const filesPath: Array<string> = []
  const fileNames: Array<string> = await promises.readdir(root)
  const namePromises = fileNames.map((name: string) => getFileStat(join(root, name)))
  const pathes = await Promise.all(namePromises)
  const files = pathes.filter(el => !el.isDir).map(el => el.path)
  filesPath.push(...files)
  const dirs = pathes.filter(el => el.isDir).map(el => el.path)
  const dirFiles = await Promise.all(dirs.map(el => getFilesPath(el)))
  filesPath.push(...dirFiles.flat())
  return filesPath
}

export async function formFileObj ({
  key, path
}: FileObjectInputInterface): Promise<FileObjectOutputInterface> {
  const file = await promises.readFile(path)
  return {
    key,
    path,
    file,
  }
}
