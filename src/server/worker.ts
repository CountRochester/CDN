import { Emitter, EmitterOptions } from '@/common/emitter'
import { Worker } from 'cluster'
import { generateRandomString } from '@/common/helpers'

export interface WorkerOptions extends EmitterOptions {
  type: string,
}

const CLUSTER_EVENTS = ['disconnect', 'error', 'exit', 'listening', 'message', 'online']

export abstract class ServerWorker extends Worker {
  protected events: ReadonlyArray<string|symbol>

  status: 'ready' | 'destroyed' | 'error' | 'running'

  type: string

  constructor ({ type, events }: WorkerOptions) {
    super()
    this.type = type
    this.status = 'ready'
    this.events = [...CLUSTER_EVENTS, ...events]
  }

  on (event: string, listener: (...args: any[]) => void):this {
    if (!this.events.includes(event)) {
      throw new Error('Invalid event')
    }
    return super.on(event, listener)
  }

  abstract start(): Promise<void>

  abstract stop(): Promise<void>

  abstract destroy(): Promise<void>
}
