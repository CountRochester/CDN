import { IncomingMessage } from 'http'
import { Http2ServerRequest } from 'http2'
import { join } from 'path'
import { AsyncQueue, Task } from '@/async-queue'
import { Worker } from '@/server/worker'
import { TaskError } from '@/error/task-error'
import { FileSystemStorage, UploadedFileData, FileToWrite } from '@/storage/file-system-storage'
import { extractKeyAndFiles } from './formdata-extract'

interface UploadControllerOption {
  uploadPath: string,
  timeout?: number,
  capacity?: number,
  timeoutBeforeDestroy?: number
}

const DESTROYED_ERROR = () => new Error('The UploadController is destroyed')
const TIMEOUT_ERROR = () => new Error('File upload timeout error')

export function getFilesToWrite (rawContent: UploadedFileData): FileToWrite[] {
  const parsedContent = extractKeyAndFiles(rawContent.file)

  const output: FileToWrite[] = []
  parsedContent.files.forEach(el => {
    const key = parsedContent.keys.find(element => element.name === el.filename)
    const relativePath = key ? key.value : ''
    output.push({
      relativePath: join(relativePath, el.filename),
      content: el.value,
      contentType: el.contentType
    })
  })
  return output
}

export class UploadController extends Worker {
  queue: AsyncQueue<FileToWrite[]>

  fs: FileSystemStorage

  #timeout: number

  /**
   * Start event
   * @event UploadController#start
   * @type {undefined}
   */

  /**
   * @event UploadController#stop
   * @type {undefined}
   */

  constructor ({
    uploadPath,
    timeout = 5000,
    capacity = 100,
    timeoutBeforeDestroy = 10000
  }: UploadControllerOption) {
    super({
      events: ['start', 'stop', 'error', 'uploadStarts', 'uploadComplete'] as const,
      type: 'uploadController'
    })

    this.#timeout = timeout

    this.queue = new AsyncQueue({
      timeout: this.#timeout,
      capacity,
      timeoutBeforeDestroy
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
      await this.fs.init()
      this.fs.on('error', console.log)
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
      await this.fs.destroy(true)
      this.status = 'destroyed'
    } catch (err) {
      this.status = 'error'
      this.emit('error', err)
    }
  }

  /**
   * @private
   * Uploads files and returns the content of the files with relative paths
   * @param req - IncomingMessage instance
   */
  private async uploadFiles (req: IncomingMessage | Http2ServerRequest): Promise<FileToWrite[]> {
    this.emit('uploadStarts')
    await this.fs.initWriteStream()
    req.on('data', (chunk: Buffer) => {
      this.fs.writeStream(chunk)
    })
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    req.on('end', () => this.fs.endWriteStream(true))
    const rawContent = await new Promise<UploadedFileData>((resolve, reject) => {
      this.fs.on('error', reject)
      this.fs.on('completeUpload', (uploadedFileData: UploadedFileData) => {
        resolve(uploadedFileData)
      })
    })

    const filesToWrite = getFilesToWrite(rawContent)
    this.emit('uploadComplete', filesToWrite)
    return filesToWrite
  }

  /**
   * Uploads files and returns the content of the files with their relative paths
   * @param req - IncomingMessage instance
   */
  async upload (req: IncomingMessage | Http2ServerRequest): Promise<FileToWrite[]> {
    const uploadTask = new Task<FileToWrite[]>({
      handler: this.uploadFiles.bind(this, req)
    })
    await this.queue.add(uploadTask)
    if (this.queue.status === 'ready') {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.queue.start()
    }
    return new Promise<FileToWrite[]>((resolve, reject) => {
      this.queue.on('complete', ({ taskId, result }) => {
        if (taskId === uploadTask.id) {
          resolve(result)
        }
      })

      this.queue.on('error', (err) => {
        if (err instanceof TaskError) {
          if (err.detail.taskId === uploadTask.id) {
            reject(err)
          }
        }
      })

      setTimeout(() => {
        reject(TIMEOUT_ERROR())
      }, this.#timeout)
    })
  }
}
