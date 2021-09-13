import { AsyncQueue, Task } from '@/async-queue'
import { FileSystemStorage } from '@/storage/file-system-storage'
import {
  MemoryMap, STATE_STORAGE_LENGTH, MAX_WRITING_WORKERS,
  WorkersStateStorage, INVALID_WORKER_INDEX
} from '@/memory-map'
import { FileObjectOutputInterface } from '@/storage/lib'
import { ServerWorker } from './worker'

interface ServiceWorkerOption {
  rootPath: string
  capacity: number
  stateStorage: WorkersStateStorage
  workerIndex: number
}

interface UpdateOptions {
  file: Buffer
  relativePath: string
}

const DESTROYED_ERROR = () => new Error('The ServiceWorker is destroyed')

export class ServiceWorker extends ServerWorker {
  queue: AsyncQueue<any>

  #sharedBuffer: SharedArrayBuffer

  fs: FileSystemStorage

  memoryMap: MemoryMap | undefined

  #capacity: number

  #stateStorage: WorkersStateStorage

  #workerIndex: number

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

  constructor ({
    rootPath, capacity, stateStorage, workerIndex
  }: ServiceWorkerOption) {
    super({
      type: 'serviceWorker',
      events: ['start', 'stop', 'error', 'update'] as const
    })

    if (workerIndex <= 0 || workerIndex > MAX_WRITING_WORKERS) {
      throw INVALID_WORKER_INDEX()
    }

    this.#capacity = +capacity + STATE_STORAGE_LENGTH
    this.#sharedBuffer = new SharedArrayBuffer(this.#capacity)

    const buf = Buffer.from(this.#sharedBuffer)
    stateStorage.storage.copy(buf)
    this.#stateStorage = WorkersStateStorage.fromBuffer(buf)
    this.#workerIndex = workerIndex

    this.queue = new AsyncQueue({
      timeout: 5000,
      capacity: 100,
      timeoutBeforeDestroy: 10000
    })

    this.fs = new FileSystemStorage({ rootPath })
  }

  get capacity (): number {
    return this.#capacity - STATE_STORAGE_LENGTH
  }

  get workerIndex (): number {
    return this.#workerIndex
  }

  /**
   * Writes the files into the sharedBuffer
   * @param files - files to write into the shared buffer
   */
  private formBuffer (files: FileObjectOutputInterface[]): void {
    const buffer = Buffer.from(this.#sharedBuffer)
    let writtenBytes = STATE_STORAGE_LENGTH
    this.#stateStorage.setWriting(this.#workerIndex, true)
    files.forEach(el => {
      if (writtenBytes >= buffer.length) {
        return
      }
      el.file.copy(buffer, writtenBytes, 0, el.file.length)
      writtenBytes += el.file.length
    })
    this.#stateStorage.setWriting(this.#workerIndex, false)
  }

  private clearBuffer (): void {
    const buffer = Buffer.from(this.#sharedBuffer)
    buffer.fill(0, STATE_STORAGE_LENGTH)
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

  private async initStorage (): Promise<void> {
    const files = await this.fs.readAllFiles()
    const sortedFiles = this.sortFiles(files)
    this.formBuffer(sortedFiles)
    this.memoryMap = new MemoryMap({
      capacity: this.#capacity,
      files: sortedFiles.map(el => ({ path: el.relativePath, content: el.file }))
    })
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
      await this.initStorage()
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
   * Clears the data. You cannot use the worker after destroy.
   * It do not clears stateStorage
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

  /**
   * Updates the buffer with the file if enough space or renew the buffer and the memoryMap
   */
  private async update ({ file, relativePath }: UpdateOptions): Promise<void> {
    if (this.memoryMap && (this.memoryMap.size + file.length) < this.capacity) {
      const buffer = Buffer.from(this.#sharedBuffer)
      this.#stateStorage.setWriting(this.#workerIndex, true)
      file.copy(buffer, this.memoryMap.size, 0, file.length)
      this.#stateStorage.setWriting(this.#workerIndex, false)
      this.memoryMap.addFile({ content: file, path: relativePath })
    } else {
      await this.#stateStorage.waitToWrite(this.#workerIndex)
      await this.initStorage()
    }
    this.emit('update', { memoryMap: this.memoryMap })
    this.#stateStorage.setWritePending(false)
  }

  /**
   * Writes the file to the storage and updates the memoryMap
   * @param path - relative path of the file
   * @param file - file content
   */
  async writeFile (path: string, file: Buffer): Promise<void> {
    this.#stateStorage.setWritePending(true)
    const writeHandler = async () => {
      const newRelativePath = await this.fs.writeFile(path, file)
      await this.update({
        file,
        relativePath: newRelativePath
      })
    }

    const newFileTask = new Task<void>({
      handler: writeHandler
    })

    await this.queue.add(newFileTask)
    if (this.queue.status === 'ready') {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.queue.start()
    }
  }
}
