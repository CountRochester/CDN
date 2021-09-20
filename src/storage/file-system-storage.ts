import {
  FSWatcher, promises, watch, constants, access, PathLike, readFile,
  createWriteStream, WriteStream
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
  uploadPath?: string
}

export interface UploadedFileData extends FileObjectOutputInterface {
  isRemoved: boolean
}

export type FileToWrite = {
  relativePath: string
  content: Buffer
  contentType?: string
}

type EventType = 'rename' | 'change'

const IS_DIR_ERROR = (): Error => new Error('The input path is a directory')
const NO_WRITE_STREAM = (): Error => new Error('There is no write stream initialized')
const WRITE_EXISTS = (): Error => new Error('The write stream is already exists')
const NO_UPLOAD_FILE_PATH = (): Error => new Error('There is no upload file path found')
const CAN_NOT_READ_FILE = (): Error => new Error('Error reading file')

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

export function destroyStream (stream: WriteStream): void {
  stream.end()
  // stream.destroy()
}

/**
 * Describes file system storage, performing the read/write/watch
 * functions
 */
export class FileSystemStorage extends Emitter {
  rootPath: string

  #writeStream: WriteStream | undefined

  #uploadFilePath: string | undefined

  isWatching: boolean

  private watcher: FSWatcher|undefined

  constructor (options: FileSystemStorageOptions) {
    super({
      events: ['change', 'delete', 'new', 'error', 'completeUpload', 'startUpload'] as const
    })
    this.rootPath = options.rootPath
    this.isWatching = false
  }

  /**
   * Creates any needed paths
   */
  async init (): Promise<void> {
    try {
      await makeDir(this.rootPath)
    } catch (err) {
      this.emit('error', err)
    }
  }

  /**
   * Returns the object, contains the file content, relative and absolute path
   * @param path - relative path of the file
   */
  async getFile (path: string): Promise<FileObjectOutputInterface|undefined> {
    try {
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
    } catch (err) {
      this.emit('error', err)
      return undefined
    }
  }

  /**
   * Returns the array of objects, contains content, relative and absolute path
   * all of the files inside the input directory and subdirectories
   * @param path - relative path of the dir
   */
  async readDir (path: string): Promise<Array<FileObjectOutputInterface>|undefined> {
    try {
      const relativePaths = (await getFilesPath(join(this.rootPath, path)))
        .map(el => relative(this.rootPath, el))

      const paths = relativePaths.map(el => ({
        relativePath: el,
        absolutePath: join(this.rootPath, el)
      }))
      const fileObjs = await Promise.all(paths.map(formFileObj))
      return fileObjs
    } catch (err) {
      this.emit('error', err)
      return undefined
    }
  }

  /**
   * Returns the array of objects, contains content, relative and absolute path
   * all of the files inside the root directory and subdirectories
   * @param path - relative path of the dir
   */
  async readAllFiles (): Promise<Array<FileObjectOutputInterface>|undefined> {
    const output = await this.readDir('')
    return output
  }

  /**
   * Writes the new file and adds the hash to the filename to exclude overlapping
   * @param path - relative path of the file
   * @param file - content of the file
   * @returns the relative path to the new file
   */
  async writeFile (path: string, file: Buffer): Promise<string|undefined> {
    try {
      const parsedFilePath = parse(join(this.rootPath, path))
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
    } catch (err) {
      this.emit('error', err)
      return undefined
    }
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
   * Removes temp file
   */
  private async removeTempFile (): Promise<void> {
    if (!this.#uploadFilePath) {
      throw NO_UPLOAD_FILE_PATH()
    }
    await promises.unlink(this.#uploadFilePath)
  }

  /**
   * Creates new write file stream
   */
  async initWriteStream (): Promise<void> {
    try {
      if (!this.rootPath) {
        throw NO_UPLOAD_FILE_PATH()
      }
      if (this.#writeStream) {
        throw WRITE_EXISTS()
      }
      const name = await generateRandomStringAsync(12)
      const fileName = `${name}.tmp`
      this.#uploadFilePath = join(this.rootPath, fileName)
      this.#writeStream = createWriteStream(this.#uploadFilePath, { encoding: 'hex' })
      this.emit('startUpload')
    } catch (err) {
      this.emit('error', err)
    }
  }

  /**
   * Writes data to the file stream
   * @param chunk - chunk of data to write
   * @param callback - error callback
   */
  writeStream (chunk: Buffer, callback?: (error?: Error | null) => void): void {
    try {
      if (!this.#writeStream) {
        throw NO_WRITE_STREAM()
      }
      this.#writeStream.write(chunk, () => {
        if (callback) {
          callback()
        }
      })
    } catch (err) {
      if (callback && err instanceof Error) {
        callback(err)
      }
      this.emit('error', err)
    }
  }

  /**
   * Finish writing data to file
   * @param isRemoveTempFile - true if removes the temp file is needed
   * @returns content of written file
   */
  endWriteStream (isRemoveTempFile = true): void {
    try {
      if (!this.#writeStream) {
        throw NO_WRITE_STREAM()
      }
      if (!this.#uploadFilePath) {
        throw NO_UPLOAD_FILE_PATH()
      }
      this.#writeStream.end()
      this.#writeStream = undefined
      const relativePath = relative(this.rootPath, this.#uploadFilePath)
      this.getFile(relativePath)
        .then(fileContent => {
          if (!fileContent) {
            throw CAN_NOT_READ_FILE()
          }
          if (isRemoveTempFile) {
            this.removeTempFile().catch(err => { this.emit('error', err) })
          }
          this.emit('completeUpload', { ...fileContent, isRemoved: isRemoveTempFile })
        })
        .catch(err => {
          this.emit('error', err)
        })
    } catch (err) {
      if (this.#writeStream) {
        this.#writeStream.destroy()
      }
      this.emit('error', err)
    }
  }

  /**
   * Starts watching the file system
   * @TODO remove recursive options to may run on linux
   */
  watch (): void {
    try {
      if (this.watcher && this.isWatching) {
        return
      }
      this.watcher = watch(this.rootPath, {
        encoding: 'buffer', recursive: true
      }, this.watchListener.bind(this))
      this.isWatching = true
    } catch (err) {
      this.emit('error', err)
    }
  }

  /**
   * Stops the watching the file system
   */
  stopWatch (): void {
    try {
      if (!this.watcher) {
        return
      }
      this.watcher.close()
      this.isWatching = false
    } catch (err) {
      this.emit('error', err)
    }
  }

  /**
   * Clears any listeners and stops the watching the file system, immediately stops write stream
   * and deletes the upload path
   */
  async destroy (isNeedToClearRoot = false): Promise<void> {
    try {
      this.stopWatch()
      this.events.map(event => this.removeAllListeners(event))
      if (this.#writeStream) {
        this.#writeStream.end()
        this.#writeStream.destroy()
      }
      if (isNeedToClearRoot) {
        await promises.rm(this.rootPath)
      }
    } catch (err) {
      this.emit('error', err)
    }
  }
}
