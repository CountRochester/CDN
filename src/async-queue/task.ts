import { EventEmitter } from 'events'
import { generateRandomString } from '../common/helpers'

export interface TaskFunction {
  (...args: any): Promise<void>
}

export interface TaskOptions {
  handler: TaskFunction
}

export class Task extends EventEmitter {
  id: string

  handler?: TaskFunction

  status: string

  errors: Error[]

  constructor (options: TaskOptions) {
    super()
    this.id = generateRandomString()
    this.status = 'ready'
    this.handler = options.handler
    this.emit('created', this.id)
    this.errors = []
  }

  async execute (...args: any[]): Promise<void> {
    try {
      if (this.status !== 'ready') {
        throw new Error(`Invalid task status: ${this.status}`)
      }
      this.emit('beforeExecute', this.id)
      this.status = 'started'
      if (this.handler) {
        await this.handler(...args)
      }
      this.status = 'done'
      this.emit('afterExecute', this.id)
    } catch (err) {
      this.status = 'error'
      if (err instanceof Error) {
        this.errors.push(err)
      }
      this.emit('error', err)
    }
  }

  reset (): void {
    this.status = 'ready'
    this.errors = []
  }

  destroy (): void {
    this.errors = []
    this.status = 'destroyed'
    this.handler = undefined;

    ['created', 'beforeExecute', 'afterExecute', 'error']
      .map(event => this.removeAllListeners(event))
  }
}
