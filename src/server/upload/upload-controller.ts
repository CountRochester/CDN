import { AsyncQueue, Task } from '@/async-queue'
import { IncomingMessage } from 'http'
import { FileSystemStorage, UploadedFileData } from '@/storage/file-system-storage'
import { FileObjectOutputInterface } from '@/storage/lib'
import { Worker } from '../worker'

interface UploadControllerOption {
  uploadPath: string
}

const DESTROYED_ERROR = () => new Error('The UploadController is destroyed')

export class UploadController extends Worker {
  queue: AsyncQueue<any>

  fs: FileSystemStorage

  /**
   * Start event
   * @event UploadController#start
   * @type {undefined}
   */

  /**
   * @event UploadController#stop
   * @type {undefined}
   */

  constructor ({ uploadPath }: UploadControllerOption) {
    super({
      events: ['start', 'stop', 'error', 'uploadStarts', 'uploadComplete'] as const,
      type: 'uploadController'
    })

    this.queue = new AsyncQueue({
      timeout: 5000,
      capacity: 100,
      timeoutBeforeDestroy: 10000
    })

    this.fs = new FileSystemStorage({ rootPath: uploadPath })
  }

  /**
   * Starts the upload controller
   * @emits UploadController#start
   */
  async start (): Promise<void> {
    try {
      if (this.status === 'destroyed') {
        throw DESTROYED_ERROR()
      }
      await this.initStorage()
      this.status = 'running'
      this.emit('start')
    } catch (err) {
      this.status = 'error'
      this.emit('error', err)
    }
  }

  /**
   * Stops the service worker
   */
  async stop (): Promise<void> {
    try {
      if (this.status === 'destroyed') {
        throw DESTROYED_ERROR()
      }
      if (this.queue.status === 'running') {
        await this.queue.stop()
      }

      if (this.fs.isWatching) {
        this.fs.stopWatch()
      }
      this.status = 'ready'
      this.emit('stop')
    } catch (err) {
      this.status = 'error'
      this.emit('error', err)
    }
  }

  /**
   * Clears the data. You cannot use the worker after destroy.
   * It do not clears stateStorage
   */
  async destroy (): Promise<void> {
    try {
      await this.queue.destroy()
      this.fs.destroy()
      this.status = 'destroyed'
    } catch (err) {
      this.status = 'error'
      this.emit('error', err)
    }
  }

  async uploadFile (req: IncomingMessage): Promise<UploadedFileData> {
    await this.fs.initWriteStream()
    req.on('data', chunk => this.fs.writeStream(chunk))
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    req.on('end', () => this.fs.endWriteStream(true))
    return new Promise((resolve, reject) => {
      this.fs.on('error', reject)
      this.fs.on('completeUpload', (uploadedFileData: UploadedFileData) => {
        resolve(uploadedFileData)
      })
    })
  }
}
