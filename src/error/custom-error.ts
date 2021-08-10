export interface CustomErrorDetail {
  timestamp: Date
  payload?: string
}

export interface CustomErrorInterface1 {
  message: string
  error?: Error
  detail?: string
}

export interface CustomErrorInterface2 {
  message?: string
  error: Error
  detail?: string
}

const DEFAULT_ERROR_MESSAGE = 'Unknown error'

export class CustomError extends Error {
  detail: CustomErrorDetail

  constructor (options: CustomErrorInterface1|CustomErrorInterface2) {
    super(options?.message || options.error?.message || DEFAULT_ERROR_MESSAGE)
    this.detail = {
      timestamp: new Date(),
      payload: options.detail
    }
  }

  static createAndThrow (options: CustomErrorInterface1|CustomErrorInterface2): never {
    const error = new this(options)
    throw error
  }
}
