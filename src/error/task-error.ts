import { CustomErrorInterface1, CustomErrorInterface2, CustomError } from './custom-error'

export interface TaskErrorDetail {
  timestamp: Date
  taskId: string
}

export class TaskError extends CustomError {
  detail: TaskErrorDetail

  constructor (options: CustomErrorInterface1|CustomErrorInterface2) {
    super(options)
    this.detail = {
      timestamp: new Date(),
      taskId: typeof options.detail === 'string'
        ? options.detail || 'unknown'
        : 'unknown'
    }
  }
}
