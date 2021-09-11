/* eslint-disable max-statements */
import { EventEmitter } from 'events'
import { Task } from '../../async-queue/task'

describe('Task test case', () => {
  test('should return the right task value', () => {
    const handler = jest.fn(() => Promise.resolve())
    const task = new Task({ handler })
    expect(task).toBeTruthy()
    expect(task).toBeInstanceOf(EventEmitter)
    expect(task.id).toBeTruthy()
    expect(task.status).toBeTruthy()
    expect(task.errors).toBeTruthy()
    expect(typeof task.id).toBe('string')
    expect(typeof task.status).toBe('string')
    expect(task.status).toBe('ready')
    expect(Array.isArray(task.errors)).toBe(true)
    expect(task.handler).toEqual(handler)
    expect(typeof task.execute).toBe('function')
    expect(typeof task.reset).toBe('function')
  })

  test('should execute the handler', async () => {
    const handler = jest.fn(() => Promise.resolve())
    const task = new Task({ handler })
    let before
    let after
    task.on('beforeExecute', (id: string) => { before = id })
    task.on('afterExecute', (id: string) => { after = id })
    await task.execute('arg1', 'arg2')
    expect(handler).toBeCalledWith('arg1', 'arg2')
    expect(task.status).toBe('done')
    expect(before).toBe(task.id)
    expect(after).toBe(task.id)
  })

  test('should emit an error', async () => {
    const testError = new Error('test')
    const handler = jest.fn(() => Promise.reject(testError))
    const task = new Task({ handler })
    let before
    let after
    let err
    task.on('beforeExecute', (id: string) => { before = id })
    task.on('afterExecute', (id: string) => { after = id })
    task.on('error', (error: Error) => { err = error })
    await task.execute('arg1', 'arg2')
    expect(handler).toBeCalledWith('arg1', 'arg2')
    expect(task.status).toBe('error')
    expect(before).toBe(task.id)
    expect(after).toBe(undefined)
    expect(err).toEqual(testError)
    expect(task.errors).toEqual([testError])
  })

  test('should reset after error', async () => {
    const testError = new Error('test')
    const handler = jest.fn(() => Promise.reject(testError))
    const task = new Task({ handler })
    let err
    task.on('error', (error: Error) => { err = error })
    await task.execute()
    task.reset()
    expect(task.status).toBe('ready')
    expect(task.errors).toEqual([])
  })

  test('should reset after successfully complete', async () => {
    const handler = jest.fn(() => Promise.resolve())
    const task = new Task({ handler })
    await task.execute()
    task.reset()
    expect(task.status).toBe('ready')
    expect(task.errors).toEqual([])
  })

  test('should successfully destroyed', async () => {
    const testError = new Error('test')
    const handler = jest.fn(() => Promise.reject(testError))
    const task = new Task({ handler })
    let before
    let after
    let err
    task.on('beforeExecute', (id: string) => { before = id })
    task.on('afterExecute', (id: string) => { after = id })
    task.on('error', (error: Error) => { err = error })
    await task.execute('arg1', 'arg2')
    const firstErr = err
    task.destroy()
    expect(task.errors).toEqual([])
    expect(task.status).toBe('destroyed')
    expect(task.handler).toBeUndefined()
    try {
      await task.execute()
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(error.constructor.name).toBe('NodeError')
      expect(err).toBe(firstErr)
    }
  })
})
