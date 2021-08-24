import { generateRandomString } from '../../common/helpers'

describe('generateRandomString test case', () => {
  test('should return random string with default length', () => {
    const result = generateRandomString()
    expect(typeof result).toBe('string')
    expect(result.length).toBe(56)
  })

  test('should return random string with expected length', () => {
    const length = 87
    const result = generateRandomString(length)
    expect(typeof result).toBe('string')
    expect(result.length).toBe(length)
  })
})
