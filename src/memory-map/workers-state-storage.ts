import {
  STATE_STORAGE_LENGTH, START_OFFSET, MAX_WRITING_WORKERS,
  MAX_READING_WORKERS, WRITE_WAIT_INTERVAL
} from '@/config/workers-state-storage'

import { READ_WAITING_TIMEOUT } from '@/config/workers'

/**
  * @param {number} writeWorkersQuantity - number of write workers (max 4)
  * (do not use more than one)
  * @param {number} readWorkersQuantity - number of read workers (max 32)
  * @param {Buffer=} buffer - use only in static fromBuffer
  */
export interface WorkersStateStorageOptions {
  writeWorkersQuantity: number
  readWorkersQuantity: number
  buffer?: Buffer
}

const INVALID_WORKERS_QUANTITY = (): Error => new Error('Invalid workers quantity')
export const INVALID_WORKER_INDEX = (): Error => new Error('Invalid worker index')
const INVALID_BUFFER = (): Error => new Error('Invalid buffer length')
const ALREADY_SET = (): Error => new Error('The value is already set')
// eslint-disable-next-line max-len
const WAITING_TIMEOUT = (workerIndex: number): Error => new Error(`Worker ${workerIndex}: Write waiting timeout`)

/*
0   1   2   3   4   5   6   7...         ...38
|00 |00 |00 |00 |00 |00 |00 |00...       ...|00
|   |   |   |   |   |   |   |               |
|writeWorkersQuantity   |   |               |
    |readWorkersQuantity|   |               |
        |isWriting[1]   |   |               |
            |isWriting[2]   |               |
                |isWriting[3]               |
                    |isWriting[4]           |
                        |isReading[1]       |
                            |isReading[2]   |
                                            |WritePending
*/

/**
 * Describes state storage of the workers
 */
export class WorkersStateStorage {
  writeWorkersQuantity: number

  readWorkersQuantity: number

  storage: Buffer

  /**
   * Takes first bytes and converts it to new WorkersStateStorage instance
   * @param buf - buffer to process
   */
  static fromBuffer (buf: Buffer): WorkersStateStorage {
    if (buf.length < STATE_STORAGE_LENGTH) {
      throw INVALID_BUFFER()
    }
    const buffer = buf.slice(0, STATE_STORAGE_LENGTH)
    const writeWorkersQuantity = buffer[0]
    const readWorkersQuantity = buffer[1]
    return new WorkersStateStorage({
      writeWorkersQuantity, readWorkersQuantity, buffer
    })
  }

  constructor ({ writeWorkersQuantity, readWorkersQuantity, buffer }: WorkersStateStorageOptions) {
    if (writeWorkersQuantity > MAX_WRITING_WORKERS || readWorkersQuantity > MAX_READING_WORKERS) {
      throw INVALID_WORKERS_QUANTITY()
    }
    this.writeWorkersQuantity = writeWorkersQuantity
    this.readWorkersQuantity = readWorkersQuantity
    if (buffer) {
      this.storage = buffer
    } else {
      this.storage = Buffer.alloc(STATE_STORAGE_LENGTH).fill(0)
      this.storage[0] = this.writeWorkersQuantity
      this.storage[1] = this.readWorkersQuantity
    }
  }

  /**
   * Returns the state by index
   * @param index - index of the worker
   */
  private getStateByIndex (index: number): boolean {
    const state = Atomics.load(this.storage, index)
    const output = !!state
    return state === Atomics.load(this.storage, index) ? output : !output
  }

  /**
   * Sets the new value and returns the old one
   * @param index - index of the worker
   * @param value - value to set
   */
  private setStateByIndex (index: number, value: number): boolean {
    const oldValue = Atomics.exchange(this.storage, index, value)
    if (oldValue === value) {
      throw ALREADY_SET()
    }
    return !!oldValue
  }

  /**
   * Returns current state of writing worker by its index
   * @param workerIndex - index of the worker
   */
  isWriting (workerIndex: number): boolean {
    if (workerIndex <= 0 || workerIndex > this.writeWorkersQuantity) {
      throw INVALID_WORKER_INDEX()
    }
    const index = workerIndex + START_OFFSET
    return this.getStateByIndex(index)
  }

  /**
   * Returns current state of reading worker by its index
   * @param workerIndex - index of the worker
   */
  isReading (workerIndex: number): boolean {
    if (workerIndex <= 0 || workerIndex > this.readWorkersQuantity) {
      throw INVALID_WORKER_INDEX()
    }
    const index = workerIndex + START_OFFSET + MAX_WRITING_WORKERS
    return this.getStateByIndex(index)
  }

  /**
   * Returns if any of writing workers pending to write
   */
  isWritePending (): boolean {
    const index = START_OFFSET + MAX_WRITING_WORKERS + MAX_READING_WORKERS + 1
    return this.getStateByIndex(index)
  }

  /**
   * Sets new state of the writing worker by its index
   * @param workerIndex - index of the worker
   * @param value - new value
   */
  setWriting (workerIndex: number, value: boolean): void {
    if (workerIndex <= 0 || workerIndex > this.writeWorkersQuantity) {
      throw INVALID_WORKER_INDEX()
    }
    const valueToWrite = value ? 1 : 0
    const index = workerIndex + START_OFFSET
    this.setStateByIndex(index, valueToWrite)
  }

  /**
   * Sets new state of the reading worker by its index
   * @param workerIndex - index of the worker
   * @param value - new value
   */
  setReading (workerIndex: number, value: boolean): void {
    if (workerIndex <= 0 || workerIndex > this.readWorkersQuantity) {
      throw INVALID_WORKER_INDEX()
    }
    const valueToWrite = value ? 1 : 0
    const index = workerIndex + START_OFFSET + MAX_WRITING_WORKERS
    this.setStateByIndex(index, valueToWrite)
  }

  /**
   * Sets if the any of writing worker is pending to write
   * @param value - new value
   */
  setWritePending (value: boolean): void {
    const valueToWrite = value ? 1 : 0
    const index = START_OFFSET + MAX_WRITING_WORKERS + MAX_READING_WORKERS + 1
    this.setStateByIndex(index, valueToWrite)
  }

  /**
   * Exports all the data in buffer instance
   */
  export (): Buffer {
    return this.storage
  }

  /**
   * Waits for every reading workers stops the reading
   * @param workerIndex - index of the worker
   */
  async waitToWrite (workerIndex: number): Promise<void> {
    const interval = WRITE_WAIT_INTERVAL + workerIndex
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(WAITING_TIMEOUT(workerIndex))
      }, READ_WAITING_TIMEOUT)

      const watcher = setInterval(() => {
        let stoppedReadingWorkers = 0
        for (let i = 1; i <= this.readWorkersQuantity; i++) {
          if (!this.isReading(i)) {
            stoppedReadingWorkers++
          }
        }
        if (stoppedReadingWorkers === this.readWorkersQuantity) {
          clearTimeout(timeout)
          clearInterval(watcher)
          resolve(true)
        }
      }, interval)
    })
  }
}
