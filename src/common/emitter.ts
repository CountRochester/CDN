import { EventEmitter } from 'events'

export interface EmotterOptions {
  events: ReadonlyArray<string|symbol>
}

export type EmitFunction = (event: string | symbol, payload?: any) => boolean

export abstract class Emitter extends EventEmitter {
  protected events: ReadonlyArray<string|symbol>

  constructor (options: EmotterOptions) {
    super()
    this.events = options.events
  }

  abstract destroy(): void | Promise<void>

  // eslint-disable-next-line max-len
  on (event: string|symbol, listener: (...args: any[]) => void):this {
    if (!this.events.includes(event)) {
      throw new Error('Invalid event')
    }
    return super.on(event, listener)
  }

  emit (event: string | symbol, payload?: any): boolean {
    const listeners = this.listenerCount(event)
    if (listeners) {
      return super.emit(event, payload)
    }
    return false
  }
}
