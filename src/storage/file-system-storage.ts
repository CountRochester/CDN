import { FSWatcher, promises, watch } from 'fs'
import { Emitter } from '@/common/emitter'
import { join } from 'path'
import {
  isDir, FileObjectOutputInterface, getFilesPath, formFileObj
} from '@/storage/lib'

export interface FileSystemStorageOptions {
  rootPath: string
}

type EventType = 'rename' | 'change'

const IS_DIR_ERROR = (): Error => new Error('The input path is a dirrectory')

export class FileSystemStorage extends Emitter {
  rootPath: string

  isWatching: boolean

  private watcher: FSWatcher|undefined

  constructor (options: FileSystemStorageOptions) {
    super({
      events: ['change']
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
  private watchListener (eventType: EventType, filename: Buffer) {
    console.log(eventType, filename.toString())
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
