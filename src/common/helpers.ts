import { randomBytes } from 'crypto'

export function generateRandomString (length = 56): string {
  const buf = randomBytes(Math.ceil(length / 2))
  return buf.toString('hex').slice(0, length)
}

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

export function timeout (ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => { resolve() }, ms)
  })
}

export function timeoutReject (ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => { reject() }, ms)
  })
}
