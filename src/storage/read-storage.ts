import { TaskError } from '@/error'
import { AsyncQueue, Task, CompleteTaskResult } from '@/async-queue'
import { MemoryMap } from '@/memory-map'

export interface ReadStorageOptions {
  queue: AsyncQueue<Buffer>
  memoryMap: MemoryMap
  sharedBuffer: SharedArrayBuffer
}

type HandlerFunction = (...args: any[]) => void

const NOT_FOUND_MESSAGE = 'The file not found'

const ERROR_FILE_NOT_FOUND = ():Error => new Error(NOT_FOUND_MESSAGE)

export class ReadStorage {
  #queue: AsyncQueue<Buffer>

  #memoryMap: MemoryMap

  buffer: Buffer

  constructor (options: ReadStorageOptions) {
    this.#queue = options.queue
    this.#memoryMap = options.memoryMap
    this.buffer = Buffer.from(options.sharedBuffer)
  }

  get capacity (): number {
    return this.#memoryMap.capacity
  }

  get currentSize (): number {
    return this.#memoryMap.size
  }

  get filesCount (): number {
    return this.#memoryMap.length
  }

  get isEmpty (): boolean {
    return this.currentSize === 0
  }

  private async getFile (path: string): Promise<Buffer> {
    const address = this.#memoryMap.getFileAddress(path)
    if (!address) {
      return Promise.reject(ERROR_FILE_NOT_FOUND())
    }
    const file = this.buffer.slice(address.start, address.end)
    return Promise.resolve(file)
  }

  private async getFiles (pathes: string[]): Promise<Buffer[]> {
    const result = await Promise.allSettled(pathes.map(path => this.getFile(path)))
    const success = result
      .filter(el => el.status === 'fulfilled') as PromiseFulfilledResult<Buffer>[]

    return success.map(el => el.value)
  }

  public async readFile (path: string): Promise<Buffer> {
    const readTask = new Task<Buffer>({ handler: this.getFile.bind(this, path) })
    await this.#queue.add(readTask)
    const errorHandler = (reject: (reason: any) => void) => (error: TaskError) => {
      if (error.detail.taskId === readTask.id) {
        reject(error)
      }
    }
    const successHandler = (resolve: (value: Buffer | PromiseLike<Buffer>) => void) => ({
      taskId, result
    }: CompleteTaskResult<Buffer>) => {
      if (taskId === readTask.id) {
        resolve(result)
      }
    }

    let errHandler!: HandlerFunction
    let succHandler!: HandlerFunction

    try {
      const file = await new Promise<Buffer>((resolve, reject) => {
        errHandler = errorHandler(reject)
        succHandler = successHandler(resolve)
        this.#queue.on('error', errHandler)
        this.#queue.on('complete', succHandler)
        if (this.#queue.status === 'ready') {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.#queue.start()
        }
      })
      return file
    } finally {
      this.#queue.removeListener('error', errHandler)
      this.#queue.removeListener('complete', succHandler)
    }
  }

  public async destroy (): Promise<void> {
    await this.#queue.destroy()
  }
}
