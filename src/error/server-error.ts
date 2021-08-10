import { CustomError } from './custom-error'

const DEFAULT_SERVER_MESSAGE = 'Internal server error'
const DEFAULT_SERVER_CODE = 500

export interface ServerErrorInterface {
  code?: number
  message?: string
  error?: Error
  detail?: string
}

export class ServerError extends CustomError {
  code: number

  constructor (options: ServerErrorInterface) {
    super({
      message: options.message || options.error?.message || DEFAULT_SERVER_MESSAGE,
      error: options.error,
      detail: options.detail
    })
    this.code = options.code || DEFAULT_SERVER_CODE
  }

  static createAndThrow (options: ServerErrorInterface): never {
    const error = new this(options)
    throw error
  }
}
