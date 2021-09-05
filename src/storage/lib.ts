import { promises } from 'fs'
import { join, relative, sep } from 'path'

interface FileStat {
  path: string
  isDir: boolean
}

interface FileObjectInputInterface {
  relativePath: string
  absolutePath: string
}

export interface FileObjectOutputInterface extends FileObjectInputInterface {
  file: Buffer
}

/**
 * Returns true if the input string is a dirrectory
 * @param path - path of the file or dirrectory
 */
export async function isDir (path: string): Promise<boolean> {
  const stats = await promises.lstat(path)
  return stats.isDirectory()
}

/**
 * Returns the stats of the path (path with prop isDir)
 * @param path - path of the file or dirrectory
 */
export async function getFileStat (path: string): Promise<FileStat> {
  const isDirrectory = await isDir(path)
  return {
    path,
    isDir: isDirrectory
  }
}

/**
 * Recursively reads the path and returns the array of files
 * @param root - root path
 * @returns array of files inside the root
 */
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

/**
 * Forms the file object, contains the relativePath ,
 * the absolute path of the file and content of the file
 * @param options.relativePath - the relative path of the file
 * @param options.path - the absolute path of the file
 */
export async function formFileObj ({
  relativePath, absolutePath
}: FileObjectInputInterface): Promise<FileObjectOutputInterface> {
  const file = await promises.readFile(absolutePath)
  return {
    relativePath,
    absolutePath,
    file,
  }
}

/**
 * Reads the content of input dirrectory
 * @param root - root path for reading files
 * @returns Array of the files with absolute and relative paths
 */
export async function readFilesFromPath (root: string): Promise<Array<FileObjectOutputInterface>> {
  const paths = await getFilesPath(root)
  const keysObj = paths
    .map(el => relative(root, el))
    .map(el => el.split(sep).join('/'))
    .map((el, index) => ({ relativePath: el, absolutePath: paths[index] }))
  const output = await Promise.all(keysObj.map(formFileObj))
  return output
}
