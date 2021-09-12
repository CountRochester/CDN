import { AsyncQueue, Task } from '@/async-queue'
import { FileSystemStorage } from '@/storage/file-system-storage'
import { MemoryMap } from '@/memory-map'
import { FileObjectOutputInterface } from '@/storage/lib'
import { Worker } from './worker'

const DESTROYED_ERROR = () => new Error('The ServiceWorker is destroyed')

export class ServiceWorker extends Worker {
  queue: AsyncQueue<any>

  #sharedBuffer: SharedArrayBuffer

  fs: FileSystemStorage

  memoryMap: MemoryMap | undefined

  #capacity: number

  /**
   * Start event
   * @event ServiceWorker#start
   * @type {object}
   * @property {MemoryMap} memoryMap
   * @property {SharedArrayBuffer} sharedBuffer
   */

  /**
   * @event ServiceWorker#stop
   * @type {undefined}
   */

  /**
   * Update event
   * @event ServiceWorker#update
   * @type {object}
   * @property {MemoryMap} memoryMap
   */

  constructor ({ rootPath, capacity }: { rootPath: string, capacity: number }) {
    super({
      type: 'serviceWorker',
      events: ['start', 'stop', 'error', 'update'] as const
    })

    this.#capacity = capacity
    this.#sharedBuffer = new SharedArrayBuffer(this.#capacity)

    this.queue = new AsyncQueue({
      timeout: 5000,
      capacity: 100,
      timeoutBeforeDestroy: 10000
    })

    this.fs = new FileSystemStorage({ rootPath })
  }

  get capacity (): number {
    return this.#capacity
  }

  /**
   * Writes the files into the sharedBuffer
   * @param files - files to write into the shared buffer
   */
  private formBuffer (files: FileObjectOutputInterface[]): void {
    const buffer = Buffer.from(this.#sharedBuffer)
    let writtenBytes = 0
    files.forEach(el => {
      if (writtenBytes >= buffer.length) {
        return
      }
      el.file.copy(buffer, writtenBytes, 0, el.file.length)
      writtenBytes += el.file.length
    })
  }

  private clearBuffer (): void {
    const buffer = Buffer.from(this.#sharedBuffer)
    buffer.fill(0)
  }

  /**
   * Sorts the files
   * @TODO connect the statistic plugin for sorting
   * @param files - file objects that need to be sorted
   */
  // eslint-disable-next-line class-methods-use-this
  private sortFiles (files: FileObjectOutputInterface[]): FileObjectOutputInterface[] {
    const sortedFiles = files.sort((a, b) => a.file.length - b.file.length)
    return sortedFiles
  }

  /**
   * Starts the service worker
   * @emits ServiceWorker#start
   */
  async start (): Promise<void> {
    try {
      if (this.status === 'destroyed') {
        throw DESTROYED_ERROR()
      }
      const files = await this.fs.readAllFiles()
      const sortedFiles = this.sortFiles(files)
      this.formBuffer(sortedFiles)
      this.memoryMap = new MemoryMap({
        capacity: this.#capacity,
        files: sortedFiles.map(el => ({ path: el.relativePath, content: el.file }))
      })
      this.status = 'running'
      this.emit('start', {
        memoryMap: this.memoryMap,
        sharedBuffer: this.#sharedBuffer
      })
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
   * Clears the data. You cannot use the worker after destroy
   */
  async destroy (): Promise<void> {
    try {
      await this.queue.destroy()
      this.fs.destroy()
      this.clearBuffer()
      this.status = 'destroyed'
    } catch (err) {
      this.status = 'error'
      this.emit('error', err)
    }
  }

  async update ({ file, relativePath }: { file: Buffer, relativePath: string }): Promise<void> {
    if (this.memoryMap && (this.memoryMap.size + file.length) < this.capacity) {
      const buffer = Buffer.from(this.#sharedBuffer)
      file.copy(buffer, this.memoryMap.size, 0, file.length)
      this.memoryMap.addFile({ content: file, path: relativePath })
    }
    this.emit('update', { memoryMap: this.memoryMap })
    await Promise.resolve()
  }

  async writeFile (path: string, file: Buffer): Promise<void> {
    const writeHandler = async () => {
      const newRelativePath = await this.fs.writeFile(path, file)
      await this.update({
        file,
        relativePath: newRelativePath
      })
    }

    const newFileTask = new Task<void>({
      handler: writeHandler.bind(this)
    })

    await this.queue.add(newFileTask)
    if (this.queue.status === 'ready') {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.queue.start()
    }
  }
}
