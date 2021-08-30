export interface CustomErrorDetail {
  timestamp: Date
  payload?: any
}

export interface CustomErrorInterface1 {
  message: string
  error?: Error
  detail?: any
}

export interface CustomErrorInterface2 {
  message?: string
  error: Error
  detail?: any
}

const DEFAULT_ERROR_MESSAGE = 'Unknown error'

export class CustomError extends Error {
  detail: CustomErrorDetail

  constructor (options: CustomErrorInterface1|CustomErrorInterface2) {
    super(options?.message || options.error?.message || DEFAULT_ERROR_MESSAGE)
    this.detail = {
      timestamp: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      payload: options.detail
    }
  }

  static createAndThrow (options: CustomErrorInterface1|CustomErrorInterface2): never {
    const error = new this(options)
    throw error
  }

  static wrap (err: Error): CustomError {
    const error = new this(err)
    throw error
  }
}
