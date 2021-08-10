import {
  createServer, Server, ServerResponse, IncomingMessage
} from 'http'
import { EventEmitter } from 'events'
import { ServerError } from '../error'
import { SERVER_HOST, SERVER_PORT } from '../config/server'

export interface CDNResponse {
  code: number
  payload?: Buffer|string
}

export interface CDNHandler {
  (route: string): Promise<CDNResponse>
}

interface CDNServerInitParameters {
  host?: string
  port?: number
  handler: CDNHandler
}

interface ServerHandle {
  (req: IncomingMessage, res: ServerResponse): Promise<void>
}

function errorHandler (err: ServerError, res: ServerResponse): void {
  res.writeHead(err.code, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify(err))
}

export class CDNServer extends EventEmitter {
  server: Server

  host: string

  port: number

  handler: CDNHandler

  constructor (options: CDNServerInitParameters) {
    super()
    this.server = createServer()
    this.host = options.host || SERVER_HOST
    this.port = options.port || SERVER_PORT
    this.handler = options.handler
  }

  async start (): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.server.on('request', this.listener.bind(this))
    await new Promise<void>((resolve, reject): void => {
      try {
        this.server.listen(this.port, this.host, (): void => {
          resolve()
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  // eslint-disable-next-line max-statements, complexity
  async listener (req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method?.toLowerCase() !== 'get') {
        throw new Error('Method not alowed')
      }
      const route = req.url || ''
      const response = await this.handler(route)
      if (response.code !== 200) {
        ServerError.createAndThrow({
          code: response.code,
          message: typeof response.payload === 'string' ? response.payload : '',
        })
      }
      res.setHeader('Content-Type', 'text/plain')
      res.writeHead(response.code)
      res.end(response.payload)
    } catch (err) {
      console.error(err)
      if (!(err instanceof ServerError)) {
        const error = new ServerError({
          detail: JSON.stringify({
            method: req.method,
            path: req.url
          }),
          error: err instanceof Error ? err : undefined
        })
        this.emit('error', error)
        errorHandler(error, res)
      } else {
        this.emit('error', err)
        errorHandler(err, res)
      }
    }
  }
}
