import { EventEmitter } from 'events'
import { Task } from './task'
import { timeout } from '../common/helpers'
import { GRACEFULL_TIMEOUT } from '../config/async-queue'

export interface AsyncQueueOptions {
  timeout: number
  delay?: number
  capacity?: number
  timeoutBeforeDestroy?: number
}

async function timeoutDestroy (ms: number, task?: Task<any>) {
  await timeout(ms)
  task?.destroy()
}

interface Queue extends EventEmitter {
  capacity: number
}

export interface CompleteTaskResult<T> {
  taskId?: string
  result: T
}

export class AsyncQueue<T> extends EventEmitter {
  queue: Task<T>[]

  currentTask?: Task<T>

  timeout: number

  #status: string

  delay: number

  capacity: number

  timeoutBeforeDestroy: number

  #events: Array<string|symbol>

  constructor (options: AsyncQueueOptions) {
    super()
    this.timeout = options.timeout
    this.delay = options.delay || 0
    this.capacity = options.capacity || Number.MAX_SAFE_INTEGER
    this.#status = 'ready'
    this.currentTask = undefined
    this.timeoutBeforeDestroy = options.timeoutBeforeDestroy || GRACEFULL_TIMEOUT
    this.#events = ['full', 'empty', 'next', 'complete', 'error']
    this.queue = this.getProxyQueue()
  }

  get size (): number {
    return this.queue.length
  }

  get status (): string {
    return this.#status
  }

  get isFull (): boolean {
    return this.size >= this.capacity
  }

  get isEmpty (): boolean {
    return this.size === 0
  }

  private getProxyQueue () {
    const taskArray: Task<T>[] = []
    const { capacity } = this
    const emit = this.emit.bind(this)
    return new Proxy(taskArray, {
      set (target, prop: string|symbol, val): boolean {
        if (target.length > capacity) {
          return false
        }
        if (target.length === 0) {
          emit('empty')
        }
        if (prop === 'length' && typeof val === 'number') {
          target.length = val
          return true
        }
        if (val instanceof Task) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          target[Number(prop)] = val
          if (target.length === capacity) {
            emit('full')
          }
          return true
        }
        return false
      }
    })
  }

  on (event: string|symbol, listener: (...args: any[]) => void):this {
    if (!this.#events.includes(event)) {
      throw new Error('Invalid event')
    }
    return super.on(event, listener)
  }

  async add (task: Task<T>): Promise<void> {
    await timeout(this.delay)
    if (this.isFull) {
      return
    }

    this.queue.push(task)
    task.timeoutTimer = setTimeout(() => {
      this.queue = this.queue.filter(el => el.id !== task.id)
      task?.destroy()
    }, this.timeout)
  }

  async next (...args: any[]): Promise<void> {
    try {
      if (this.isEmpty || !['ready', 'running'].includes(this.#status)) {
        return
      }
      this.currentTask = this.queue.pop()
      this.emit('next', this.currentTask?.id)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = await this.currentTask?.execute(...args)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const completeResult: CompleteTaskResult<any> = { taskId: this.currentTask?.id, result }
      this.emit('complete', completeResult)
      this.currentTask?.destroy()
      this.currentTask = undefined
      if (this.isEmpty && this.#status !== 'destroyed') {
        this.#status = 'ready'
      }
    } catch (err) {
      this.emit('error', err)
    }
  }

  async start (...args: any[]): Promise<void> {
    this.#status = 'running'
    while (this.size > 0 || this.#status === 'running') {
      // eslint-disable-next-line no-await-in-loop
      await this.next(...args)
    }
    if (this.#status !== 'destroyed') {
      this.#status = 'ready'
    }
  }

  async stop (): Promise<void> {
    if (this.#status !== 'destroyed') {
      this.#status = 'ready'
    }
    if (!this.currentTask) {
      return
    }
    await new Promise<void>(resolve => {
      this.on('complete', () => {
        resolve()
      })
    })
  }

  async destroy (): Promise<void> {
    if (!['ready', 'destroyed'].includes(this.#status)) {
      const { currentTask } = this
      await Promise.race([
        this.stop(),
        timeoutDestroy(this.timeoutBeforeDestroy, currentTask)
      ])
    }

    this.queue.forEach(task => task.destroy())
    this.#status = 'destroyed'
    this.queue.length = 0
    this.#events.map(event => this.removeAllListeners(event))
  }
}
