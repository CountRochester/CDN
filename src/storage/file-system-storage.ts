import {
  FSWatcher, promises, watch, constants, access, PathLike, readFile
} from 'fs'
import { Emitter, EmitFunction } from '@/common/emitter'
import { join } from 'path'
import {
  isDir, FileObjectOutputInterface, getFilesPath, formFileObj
} from '@/storage/lib'

export interface FileSystemStorageOptions {
  rootPath: string
}

type EventType = 'rename' | 'change'

const IS_DIR_ERROR = (): Error => new Error('The input path is a dirrectory')

const eventHandlers = {
  rename: (filename: PathLike, rootPath: string, emit: EmitFunction) => {
    const relativePath = filename.toString()
    const path = join(rootPath, relativePath)
    access(path, constants.F_OK, (err) => {
      if (err) {
        emit('delete', { relativePath })
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
        })
      }
    })
  },
  change: (filename: PathLike, rootPath: string, emit: EmitFunction) => {
    const relativePath = filename.toString()
    const path = join(rootPath, relativePath)
    access(path, constants.F_OK, (err) => {
      if (err) {
        emit('error', err)
      } else {
        readFile(path, (error, file) => {
          if (error) {
            if (error.code === 'EISDIR') {
              return
            }
            emit('error', error)
          } else {
            emit('change', {
              relativePath,
              file
            })
          }
        })
      }
    })
  }
}

export class FileSystemStorage extends Emitter {
  rootPath: string

  isWatching: boolean

  private watcher: FSWatcher|undefined

  constructor (options: FileSystemStorageOptions) {
    super({
      events: ['change', 'delete', 'new', 'change', 'error']
    })
    this.rootPath = options.rootPath
    this.isWatching = false
  }

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

  async readDir (path: string): Promise<Array<FileObjectOutputInterface>> {
    const relativePaths = await getFilesPath(path)
    const paths = relativePaths.map(el => ({
      relativePath: el,
      absolutePath: join(this.rootPath, el)
    }))
    const fileObjs = await Promise.all(paths.map(formFileObj))
    return fileObjs
  }

  async readAllFiles (): Promise<Array<FileObjectOutputInterface>> {
    const output = await this.readDir(this.rootPath)
    return output
  }

  /**
   *
   * @param eventType - event type, may be one of rename or change
   * @param filename - relative path with the filename
   */
  // eslint-disable-next-line class-methods-use-this
  private watchListener (eventType: EventType, filename: PathLike) {
    eventHandlers[eventType](filename, this.rootPath, this.emit.bind(this))
  }

  /**
   * @TODO remove recursive options to may run on linux
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

  stopWatch (): void {
    if (!this.watcher) {
      return
    }
    this.watcher.close()
    this.isWatching = false
  }

  destroy (): void {
    this.stopWatch()
    this.events.map(event => this.removeAllListeners(event))
  }
}
