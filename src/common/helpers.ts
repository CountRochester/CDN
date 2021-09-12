import { randomBytes } from 'crypto'

/**
 * Returns random string with entered length
 * @param length - length of output string
 * @returns random string
 */
export function generateRandomString (length = 56): string {
  const buf = randomBytes(Math.ceil(length / 2))
  return buf.toString('hex').slice(0, length)
}

/**
 * Async returns random string with entered length
 * @param length - length of output string
 * @returns random string
 */
export async function generateRandomStringAsync (length = 56): Promise<string> {
  const buff = await new Promise<Buffer>((resolve, reject) => {
    randomBytes(Math.ceil(length / 2), (err, buf) => {
      if (err) {
        reject(err)
      } else {
        resolve(buf)
      }
    })
  })
  return buff.toString('hex').slice(0, length)
}

/**
 * Waits entered quantity of milliseconds
 * @param ms quantity of milliseconds to wait
 */
export function timeout (ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => { resolve() }, ms)
  })
}

/**
 * Waits entered quantity of milliseconds and then reject the promise
 * @param ms quantity of milliseconds to wait
 */
export function timeoutReject (ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => { reject() }, ms)
  })
}
