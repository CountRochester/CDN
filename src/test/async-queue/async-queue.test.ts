/* eslint-disable max-nested-callbacks */
/* eslint-disable max-statements */
import { AsyncQueue } from '../../async-queue/async-queue'
import { Task } from '../../async-queue/task'
import { timeout } from '../../common/helpers'

jest.setTimeout(50000)

describe('constructor test case', () => {
  test('should create the right object', () => {
    const options = {
      timeout: 1000,
      delay: 10,
      capacity: 5,
      timeoutBeforeDestroy: 100
    }

    const queue = new AsyncQueue<Buffer>(options)

    expect(queue.queue).toEqual([])
    expect(queue.timeout).toBe(options.timeout)
    expect(queue.delay).toBe(options.delay)
    expect(queue.capacity).toBe(options.capacity)
    expect(queue.timeoutBeforeDestroy).toBe(options.timeoutBeforeDestroy)
    expect(queue.currentTask).toBeUndefined()
    expect(queue.size).toBe(0)
    expect(queue.isFull).toBe(false)
    expect(queue.isEmpty).toBe(true)
  })
})

describe('add test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 1000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })
  test('should add tasks to the queue', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
    ])

    expect(queue.size).toBe(3)
    expect(queue.isEmpty).toBe(false)
    expect(queue.isFull).toBe(false)
    expect(queue.size).toBe(3)

    await timeout(10000)
    expect(queue.isEmpty).toBe(true)
    expect(queue.isFull).toBe(false)
    expect(queue.size).toBe(0)

    expect(task1.status).toBe('destroyed')
    expect(task2.status).toBe('destroyed')
    expect(task3.status).toBe('destroyed')
  })

  test('should emit full if the queue is full 1/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy1 })
    const task5 = new Task<Buffer>({ handler: handlerSpy2 })
    const task6 = new Task<Buffer>({ handler: handlerSpy3 })
    const fullHandler = jest.fn()

    queue.on('full', fullHandler)

    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
      queue.add(task4),
      queue.add(task5),
      queue.add(task6),
    ])
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)
  })

  test('should emit full if the queue is full 2/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy1 })
    const task5 = new Task<Buffer>({ handler: handlerSpy2 })
    const task6 = new Task<Buffer>({ handler: handlerSpy3 })
    const fullHandler = jest.fn()

    queue.on('full', fullHandler)

    await queue.add(task1)
    await queue.add(task2)
    await queue.add(task3)
    await queue.add(task4)
    await queue.add(task5)
    await queue.add(task6)
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)
  })
})

describe('next test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 1000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })

  test('should propertly run the queue 1/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy4 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy5 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const emptyHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('empty', emptyHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)

    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
      queue.add(task4),
      queue.add(task5),
    ])
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    await queue.next()
    await queue.next()
    await queue.next()
    await queue.next()
    await queue.next()

    expect(nextHandler).toBeCalledTimes(5)
    expect(completeHandler).toBeCalledTimes(5)
    expect(emptyHandler).toBeCalledTimes(1)
    expect(handlerSpy1).toBeCalledTimes(1)
    expect(handlerSpy2).toBeCalledTimes(1)
    expect(handlerSpy3).toBeCalledTimes(1)
    expect(handlerSpy4).toBeCalledTimes(1)
    expect(handlerSpy5).toBeCalledTimes(1)

    expect(queue.isFull).toBe(false)
    expect(queue.isEmpty).toBe(true)
    expect(queue.size).toBe(0)
  })

  test('should propertly run the queue 2/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy4 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy5 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const emptyHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('empty', emptyHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)

    await queue.add(task1)
    await queue.add(task2)
    await queue.add(task3)
    await queue.add(task4)
    await queue.add(task5)
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    await queue.next()
    await queue.next()
    await queue.next()
    await queue.next()
    await queue.next()

    expect(nextHandler).toBeCalledTimes(5)
    expect(completeHandler).toBeCalledTimes(5)
    expect(emptyHandler).toBeCalledTimes(1)
    expect(handlerSpy1).toBeCalledTimes(1)
    expect(handlerSpy2).toBeCalledTimes(1)
    expect(handlerSpy3).toBeCalledTimes(1)
    expect(handlerSpy4).toBeCalledTimes(1)
    expect(handlerSpy5).toBeCalledTimes(1)

    expect(queue.isFull).toBe(false)
    expect(queue.isEmpty).toBe(true)
    expect(queue.size).toBe(0)
  })
})

describe('start test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 1000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })

  test('should propertly run the queue 1/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy4 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy5 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)

    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
      queue.add(task4),
      queue.add(task5),
    ])
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    queue.on('empty', () => {
      expect(queue.status).toBe('ready')

      expect(nextHandler).toBeCalledTimes(5)
      expect(completeHandler).toBeCalledTimes(5)
      expect(handlerSpy1).toBeCalledTimes(1)
      expect(handlerSpy2).toBeCalledTimes(1)
      expect(handlerSpy3).toBeCalledTimes(1)
      expect(handlerSpy4).toBeCalledTimes(1)
      expect(handlerSpy5).toBeCalledTimes(1)

      expect(queue.isFull).toBe(false)
      expect(queue.isEmpty).toBe(true)
      expect(queue.size).toBe(0)
    })

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    queue.start()
    expect(queue.status).toBe('running')
  })

  test('should propertly run the queue 2/2', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy2 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy3 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy4 = jest.fn((): Promise<void> => Promise.resolve())
    const handlerSpy5 = jest.fn((): Promise<void> => Promise.resolve())
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)

    await queue.add(task1)
    await queue.add(task2)
    await queue.add(task3)
    await queue.add(task4)
    await queue.add(task5)
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    queue.on('empty', () => {
      expect(queue.status).toBe('ready')

      expect(nextHandler).toBeCalledTimes(5)
      expect(completeHandler).toBeCalledTimes(5)
      expect(handlerSpy1).toBeCalledTimes(1)
      expect(handlerSpy2).toBeCalledTimes(1)
      expect(handlerSpy3).toBeCalledTimes(1)
      expect(handlerSpy4).toBeCalledTimes(1)
      expect(handlerSpy5).toBeCalledTimes(1)

      expect(queue.isFull).toBe(false)
      expect(queue.isEmpty).toBe(true)
      expect(queue.size).toBe(0)
    })

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    queue.start()
    expect(queue.status).toBe('running')
  })
})

describe('stop test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 5000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })

  test('should propertly stop the queue after start', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy2 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy3 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy4 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy5 = jest.fn((): Promise<void> => timeout(900))
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()
    const emptyHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)
    queue.on('empty', emptyHandler)

    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
      queue.add(task4),
      queue.add(task5),
    ])
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    queue.start()
    expect(queue.status).toBe('running')
    await timeout(2000)
    expect(queue.size).toBe(2)
    expect(queue.isEmpty).toBe(false)
    expect(queue.isFull).toBe(false)

    await queue.stop()
    expect(queue.status).toBe('ready')
    expect(nextHandler).toBeCalledTimes(4)
    expect(completeHandler).toBeCalledTimes(3)
    expect(emptyHandler).toBeCalledTimes(1)

    expect(queue.isFull).toBe(false)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(1)
  })
})

describe('on test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 5000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })

  test('should throw if try to subscribe the illegal event', () => {
    const fullHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()
    const emptyHandler = jest.fn()
    const testSpy = jest.fn()

    queue.on('full', fullHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)
    queue.on('empty', emptyHandler)

    try {
      queue.on('test', testSpy)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('destroy test case', () => {
  let queue: AsyncQueue<Buffer>
  beforeEach(() => {
    const options = {
      timeout: 5000,
      delay: 100,
      capacity: 5,
      timeoutBeforeDestroy: 10000
    }

    queue = new AsyncQueue(options)
  })

  test('should propertly destroy the queue after start', async () => {
    const handlerSpy1 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy2 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy3 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy4 = jest.fn((): Promise<void> => timeout(900))
    const handlerSpy5 = jest.fn((): Promise<void> => timeout(900))
    const task1 = new Task<Buffer>({ handler: handlerSpy1 })
    const task2 = new Task<Buffer>({ handler: handlerSpy2 })
    const task3 = new Task<Buffer>({ handler: handlerSpy3 })
    const task4 = new Task<Buffer>({ handler: handlerSpy4 })
    const task5 = new Task<Buffer>({ handler: handlerSpy5 })
    const fullHandler = jest.fn()
    const nextHandler = jest.fn()
    const completeHandler = jest.fn()
    const emptyHandler = jest.fn()

    queue.on('full', fullHandler)
    queue.on('next', nextHandler)
    queue.on('complete', completeHandler)
    queue.on('empty', emptyHandler)

    await Promise.all([
      queue.add(task1),
      queue.add(task2),
      queue.add(task3),
      queue.add(task4),
      queue.add(task5),
    ])
    expect(fullHandler).toBeCalled()
    expect(queue.isFull).toBe(true)
    expect(queue.isEmpty).toBe(false)
    expect(queue.size).toBe(5)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    queue.start()
    expect(queue.status).toBe('running')
    await timeout(2000)
    expect(queue.size).toBe(2)
    expect(queue.isEmpty).toBe(false)
    expect(queue.isFull).toBe(false)

    await queue.destroy()
    await timeout(12000)
    expect(queue.status).toBe('destroyed')
    expect(nextHandler).toBeCalledTimes(4)
    expect(completeHandler).toBeCalledTimes(3)
    expect(emptyHandler).toBeCalledTimes(1)

    expect(queue.isFull).toBe(false)
    expect(queue.isEmpty).toBe(true)
    expect(queue.size).toBe(0)
  })
})
