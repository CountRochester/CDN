/* eslint-disable max-statements */
import { WorkersStateStorage, STATE_STORAGE_LENGTH } from '@/memory-map'
import { types } from 'util'

describe('Constructor test case', () => {
  test('should return the properly instance', () => {
    const storage = new WorkersStateStorage({
      writeWorkersQuantity: 1,
      readWorkersQuantity: 3
    })

    expect(storage.storage).toBeInstanceOf(Buffer)
    expect(storage.storage.length).toBe(STATE_STORAGE_LENGTH)
  })

  test('should throw if the invalid parameters is provided 1/3', () => {
    try {
      const storage = new WorkersStateStorage({
        writeWorkersQuantity: 7,
        readWorkersQuantity: 3
      })
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })

  test('should throw if the invalid parameters is provided 2/3', () => {
    try {
      const storage = new WorkersStateStorage({
        writeWorkersQuantity: 2,
        readWorkersQuantity: 35
      })
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })

  test('should throw if the invalid parameters is provided 3/3', () => {
    try {
      const storage = new WorkersStateStorage({
        writeWorkersQuantity: 0,
        readWorkersQuantity: 3
      })
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('fromBuffer test case', () => {
  test('should return the properly instance', () => {
    const buf = Buffer.alloc(150, 0)
    buf[0] = 1
    buf[1] = 3
    const storage = WorkersStateStorage.fromBuffer(buf)

    expect(storage.storage).toBeInstanceOf(Buffer)
    expect(storage.storage.length).toBe(STATE_STORAGE_LENGTH)
    expect(storage.writeWorkersQuantity).toBe(1)
    expect(storage.readWorkersQuantity).toBe(3)
  })

  test('should throw if the invalid parameters is provided 1/3', () => {
    try {
      const buf = Buffer.alloc(150, 0)
      const storage = WorkersStateStorage.fromBuffer(buf)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })

  test('should throw if the invalid parameters is provided 1/3', () => {
    try {
      const buf = Buffer.alloc(70, 0)
      buf[0] = 1
      buf[1] = 3
      const storage = WorkersStateStorage.fromBuffer(buf)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('isWriting test case', () => {
  test('should return state of writing workers', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 4
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)

    const buf2 = Buffer.from(sharedBuffer)
    const storage2 = WorkersStateStorage.fromBuffer(buf2)

    const result1 = storage1.isWriting(1)
    expect(result1).toBe(false)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)

    storage2.setWriting(1, true)
    const result2 = storage1.isWriting(1)
    expect(result2).toBe(true)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
  })

  test('should throw if enter an invalid index', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 2
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)
    try {
      storage1.isWriting(4)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('isReading test case', () => {
  test('should return state of writing workers', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 4
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)

    const buf2 = Buffer.from(sharedBuffer)
    const storage2 = WorkersStateStorage.fromBuffer(buf2)

    const result1 = storage1.isReading(1)
    expect(result1).toBe(false)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)

    storage2.setReading(1, true)
    const result2 = storage1.isReading(1)
    expect(result2).toBe(true)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)
  })

  test('should throw if enter an invalid index', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 2
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)
    try {
      storage1.isReading(4)
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
    }
  })
})

describe('isWritePending test case', () => {
  test('should return state of writing workers', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 4
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)

    const buf2 = Buffer.from(sharedBuffer)
    const storage2 = WorkersStateStorage.fromBuffer(buf2)

    const result1 = storage1.isWritePending()
    expect(result1).toBe(false)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)

    storage2.setWritePending(true)
    const result2 = storage1.isWritePending()
    expect(result2).toBe(true)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)
  })
})

describe('export test case', () => {
  test('should exports the buffer', () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 4
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)

    const buf2 = Buffer.from(sharedBuffer)
    const storage2 = WorkersStateStorage.fromBuffer(buf2)

    const result1 = storage1.isWritePending()
    expect(result1).toBe(false)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)
    storage2.setWritePending(true)

    const exportBuff = storage1.export()
    const storage3 = WorkersStateStorage.fromBuffer(exportBuff)
    expect(storage3.storage).toBeInstanceOf(Buffer)
    expect(storage3.storage.length).toBe(STATE_STORAGE_LENGTH)
    expect(storage3.writeWorkersQuantity).toBe(4)
    expect(storage3.readWorkersQuantity).toBe(3)

    const result2 = storage3.isWritePending()
    expect(result2).toBe(true)
    expect(storage3.isWriting(2)).toBe(false)
    expect(storage3.isWriting(3)).toBe(false)
    expect(storage3.isWriting(4)).toBe(false)
    expect(storage3.isReading(2)).toBe(false)
    expect(storage3.isReading(3)).toBe(false)
  })
})

describe('waitToWrite test case', () => {
  test.only('should return state of writing workers', async () => {
    const sharedBuffer = new SharedArrayBuffer(150)
    const buf1 = Buffer.from(sharedBuffer)
    buf1[0] = 4
    buf1[1] = 3
    const storage1 = WorkersStateStorage.fromBuffer(buf1)

    const buf2 = Buffer.from(sharedBuffer)

    console.log(types.isSharedArrayBuffer(sharedBuffer))

    const storage2 = WorkersStateStorage.fromBuffer(buf2)

    const result1 = storage1.isWritePending()
    expect(result1).toBe(false)
    expect(storage1.isWriting(2)).toBe(false)
    expect(storage1.isWriting(3)).toBe(false)
    expect(storage1.isWriting(4)).toBe(false)
    expect(storage1.isReading(1)).toBe(false)
    expect(storage1.isReading(2)).toBe(false)
    expect(storage1.isReading(3)).toBe(false)
    await storage1.waitToWrite(1)
  })
})
