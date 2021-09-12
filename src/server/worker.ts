import { Emitter, EmitterOptions } from '@/common/emitter'
import { generateRandomString } from '@/common/helpers'

export interface WorkerOptions extends EmitterOptions {
  type: string,
}

export abstract class Worker extends Emitter {
  id: string

  status: 'ready' | 'destroyed' | 'error' | 'running'

  type: string

  constructor ({ type, events }: WorkerOptions) {
    super({ events })
    this.type = type
    this.id = generateRandomString()
    this.status = 'ready'
  }

  abstract start(): Promise<void>

  abstract stop(): Promise<void>

  abstract destroy(): Promise<void>
}
