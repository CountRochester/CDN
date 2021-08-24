import { randomBytes } from 'crypto'

export function generateRandomString (length = 56): string {
  const buf = randomBytes(Math.ceil(length / 2))
  return buf.toString('hex').slice(0, length)
}
