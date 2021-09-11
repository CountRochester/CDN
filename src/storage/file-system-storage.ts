import {
  FSWatcher, promises, watch, constants, access, PathLike, readFile
} from 'fs'
import { Emitter, EmitFunction } from '@/common/emitter'
import { join, parse, relative } from 'path'
import {
  isDir, FileObjectOutputInterface, getFilesPath, formFileObj
} from '@/storage/lib'
import { CustomError } from '@/error'
import { generateRandomStringAsync } from '@/common/helpers'

export interface FileSystemStorageOptions {
  rootPath: string
}

type EventType = 'rename' | 'change'

const IS_DIR_ERROR = (): Error => new Error('The input path is a dirrectory')

export const eventHandlers = {
  /**
   * Handler for rename, create and delete file event of the file system
   * @param filename - relative path to the file
   * @param rootPath - root path
   * @param emit - emit function to emit events
   */
  // eslint-disable-next-line max-params
  rename: (filename: PathLike, rootPath: string, emit: EmitFunction, cb?: () => void): void => {
    const relativePath = filename.toString()
    const path = join(rootPath, relativePath)
    access(path, constants.F_OK, (err) => {
      if (err) {
        emit('delete', { relativePath })
        if (cb) {
          cb()
        }
      } else {
        readFile(path, (error, file) => {
          if (error) {
            emit('error', error)
          } else {
            emit('new', {
              relativePath,
              file
            })
          }
          if (cb) {
            cb()
          }
        })
      }
    })
  },
  /**
   * Handler for change file event of the file system
   * @param filename - relative path to the file
   * @param rootPath - root path
   * @param emit - emit function to emit events
   */
  // eslint-disable-next-line max-params
  change: (filename: PathLike, rootPath: string, emit: EmitFunction, cb?: () => void): void => {
    const relativePath = filename.toString()
    const path = join(rootPath, relativePath)
    access(path, constants.F_OK, (err) => {
      if (err) {
        emit('error', err)
        if (cb) {
          cb()
        }
      } else {
        readFile(path, (error, file) => {
          if (error) {
            if (error.code === 'EISDIR') {
              if (cb) {
                cb()
              }
              return
            }
            emit('error', error)
          } else {
            emit('change', {
              relativePath,
              file
            })
          }
          if (cb) {
            cb()
          }
        })
      }
    })
  }
}

/**
 * Creates dir if needed
 * @param dirPath - path of the dir
 */
export async function makeDir (dirPath: PathLike): Promise<void> {
  try {
    await promises.access(dirPath, constants.F_OK)
  } catch (noDirErr) {
    await promises.mkdir(dirPath, { recursive: true })
  }
}

/**
 * Describes file system storage, performing the read/write/watch
 * functions
 */
export class FileSystemStorage extends Emitter {
  rootPath: string

  isWatching: boolean

  private watcher: FSWatcher|undefined

  constructor (options: FileSystemStorageOptions) {
    super({
      events: ['change', 'delete', 'new', 'error'] as const
    })
    this.rootPath = options.rootPath
    this.isWatching = false
  }

  /**
   * Returns the object, contains the file content, relative and absolute path
   * @param path - relative path of the file
   */
  async getFile (path: string): Promise<FileObjectOutputInterface> {
    const filePath = join(this.rootPath, path)
    const isPathDir = await isDir(filePath)
    if (isPathDir) {
      throw IS_DIR_ERROR()
    }
    const fileContent = await promises.readFile(filePath)
    return {
      file: fileContent,
      relativePath: path,
      absolutePath: filePath
    }
  }

  /**
   * Returns the array of objects, contains content, relative and absolute path
   * all of the files inside the input dirrectory and subdirs
   * @param path - relative path of the dir
   */
  async readDir (path: string): Promise<Array<FileObjectOutputInterface>> {
    const relativePaths = (await getFilesPath(join(this.rootPath, path)))
      .map(el => relative(this.rootPath, el))

    const paths = relativePaths.map(el => ({
      relativePath: el,
      absolutePath: join(this.rootPath, el)
    }))
    const fileObjs = await Promise.all(paths.map(formFileObj))
    return fileObjs
  }

  /**
   * Returns the array of objects, contains content, relative and absolute path
   * all of the files inside the root dirrectory and subdirs
   * @param path - relative path of the dir
   */
  async readAllFiles (): Promise<Array<FileObjectOutputInterface>> {
    const output = await this.readDir('')
    return output
  }

  /**
   * Writes the new file and adds the hash to the filename to exclude overlaping
   * @param path - relative path of the file
   * @param file - content of the file
   * @returns the relative path to the new file
   */
  async writeFile (path: string, file: Buffer): Promise<string> {
    const filePath = join(this.rootPath, path)
    const parsedFilePath = parse(filePath)
    const dirPath = parsedFilePath.dir

    await makeDir(dirPath)
    let newFileName = parsedFilePath.name + await generateRandomStringAsync(40)
    let newFilePath = `${dirPath}/${newFileName}${parsedFilePath.ext}`
    try {
      await promises.access(newFilePath, constants.F_OK)
      CustomError.createAndThrow({ message: `File: ${path} already exists` })
    } catch (err) {
      if (err instanceof CustomError) {
        newFileName = parsedFilePath.name + await generateRandomStringAsync(40)
        newFilePath = `${dirPath}/${newFileName}${parsedFilePath.ext}`
      }
    }
    await promises.writeFile(newFilePath, file)
    return relative(this.rootPath, newFilePath)
  }

  /**
   * Listener of the file system
   * @param eventType - event type, may be one of rename or change
   * @param filename - relative path with the filename
   */
  // eslint-disable-next-line class-methods-use-this
  private watchListener (eventType: EventType, filename: PathLike) {
    eventHandlers[eventType](filename, this.rootPath, this.emit.bind(this))
  }

  /**
   * @TODO remove recursive options to may run on linux
   * Starts watching the file system
   */
  watch (): void {
    if (this.watcher && this.isWatching) {
      return
    }
    this.watcher = watch(this.rootPath, {
      encoding: 'buffer', recursive: true
    }, this.watchListener.bind(this))
    this.isWatching = true
  }

  /**
   * Stops the watching the file system
   */
  stopWatch (): void {
    if (!this.watcher) {
      return
    }
    this.watcher.close()
    this.isWatching = false
  }

  /**
   * Clears any listeners and stops the watching the file system
   */
  destroy (): void {
    this.stopWatch()
    this.events.map(event => this.removeAllListeners(event))
  }
}
