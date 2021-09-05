import { Emitter } from '@/common/emitter'
import { generateRandomString } from '@/common/helpers'
import { TaskError } from '@/error'

export interface TaskFunction {
  (...args: any): Promise<any>
}

export interface TaskOptions {
  handler: TaskFunction
}

export class Task<T> extends Emitter {
  id: string

  handler?: TaskFunction

  status: string

  errors: Error[]

  timeoutTimer: NodeJS.Timeout|undefined

  constructor (options: TaskOptions) {
    super({
      events: ['created', 'beforeExecute', 'afterExecute', 'error']
    })
    this.id = generateRandomString()
    this.status = 'ready'
    this.handler = options.handler
    this.emit('created', this.id)
    this.errors = []
  }

  // eslint-disable-next-line max-statements
  async execute (...args: any[]): Promise<T|undefined> {
    try {
      if (this.status !== 'ready') {
        throw new Error(`Invalid task status: ${this.status}`)
      }
      this.emit('beforeExecute', this.id)
      this.status = 'started'
      let result: any
      if (this.handler) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        result = await this.handler(...args)
      }
      this.status = 'done'
      this.emit('afterExecute', this.id)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result
    } catch (err) {
      this.status = 'error'
      let error
      if (err instanceof Error) {
        error = new TaskError({ message: err.message, error: err, detail: this.id })
        this.errors.push(error)
      }
      this.emit('error', error)
      return undefined
    }
  }

  reset (): void {
    this.status = 'ready'
    this.errors = []
  }

  destroy (): void {
    if (this.timeoutTimer) {
      this.timeoutTimer.unref()
    }
    this.errors = []
    this.status = 'destroyed'
    delete this.handler
    this.events.map(event => this.removeAllListeners(event))
  }
}
