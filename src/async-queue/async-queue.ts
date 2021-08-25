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

async function timeoutDestroy (ms: number, task?: Task) {
  await timeout(ms)
  task?.destroy()
}

export class AsyncQueue extends EventEmitter {
  queue: Task[]

  currentTask?: Task

  timeout: number

  #status: string

  delay: number

  capacity: number

  timeoutBeforeDestroy: number

  constructor (options: AsyncQueueOptions) {
    super()
    this.queue = []
    this.timeout = options.timeout
    this.delay = options.delay || 0
    this.capacity = options.capacity || Number.MAX_SAFE_INTEGER
    this.#status = 'ready'
    this.currentTask = undefined
    this.timeoutBeforeDestroy = options.timeoutBeforeDestroy || GRACEFULL_TIMEOUT
  }

  get size (): number {
    return this.queue.length
  }

  get isFull (): boolean {
    return this.size >= this.capacity
  }

  get isEmpty (): boolean {
    return this.size === 0
  }

  async add (task: Task): Promise<void> {
    if (this.isFull) {
      this.emit('full')
      return
    }
    await timeout(this.delay)
    this.queue.push(task)
    await timeout(this.timeout)
    this.queue = this.queue.filter(el => el.id !== task.id)
    task?.destroy()
  }

  async next (...args: any[]): Promise<void> {
    try {
      if (this.isEmpty) {
        this.emit('empty')
        return
      }
      this.currentTask = this.queue.pop()
      this.emit('next', this.currentTask?.id)
      await this.currentTask?.execute(...args)
      this.emit('complete', this.currentTask?.id)
      this.currentTask = undefined
    } catch (err) {
      this.emit('error', err)
    }
  }

  async start (...args: any[]): Promise<void> {
    this.#status = 'running'
    while (this.size >= 0 || this.#status === 'running') {
      // eslint-disable-next-line no-await-in-loop
      await this.next(...args)
    }
  }

  async stop (): Promise<void> {
    this.#status = 'ready'
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
    this.queue = [];

    ['full', 'empty', 'next', 'complete', 'error']
      .map(event => this.removeAllListeners(event))
  }
}
