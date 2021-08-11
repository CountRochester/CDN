import {
  createServer, Server, ServerResponse, IncomingMessage
} from 'http'
import { performance } from 'perf_hooks'
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

export interface ServerHandle {
  (req: IncomingMessage, res: ServerResponse): Promise<void>
}

interface RequestDetail {
  method?: string
  path?: string
}

interface RequestDetailStrict {
  method: string
  path: string
}

interface logRequestInterface {
  t1: number
  t2: number
  reqDetail: RequestDetail
  err?: Error
}

export function defaultErrorHandler (err: ServerError, res: ServerResponse): void {
  res.writeHead(err.code, {
    'Content-Type': 'application/json'
  })
  res.end(JSON.stringify(err))
}

export function sendResponse (res: ServerResponse, response: CDNResponse): void {
  res.writeHead(response.code, {
    'Content-Type': 'text/plain'
  })
  res.end(response.payload)
}

export function getRequestDetail (req: IncomingMessage): RequestDetailStrict {
  const detail = {
    method: req.method?.toLowerCase() || 'get',
    path: req.url || '/'
  }

  if (detail.method !== 'get') {
    ServerError.createAndThrow({
      code: 403,
      message: 'Method not alowed'
    })
  }
  return detail
}

const GOOD_LOG_COLOR = '\x1b[32m%s\x1b[0m'
const BAD_LOG_COLOR = '\x1b[31m%s\x1b[0m'

export function logRequest ({
  t1, t2, reqDetail, err
}: logRequestInterface):void {
  const time = t2 - t1
  const color = err ? BAD_LOG_COLOR : GOOD_LOG_COLOR
  // eslint-disable-next-line max-len
  const message = `${reqDetail.method?.toUpperCase() || 'GET'}: ${reqDetail.path || '/'} finished in ${time} ms`
  console.log(color, message)
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

  async listener (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const tstart = performance.now()
    try {
      const reqDetail = getRequestDetail(req)
      const route = reqDetail.path
      const response = await this.handler(route)
      if (response.code !== 200) {
        ServerError.createAndThrow({
          code: response.code,
          message: typeof response.payload === 'string' ? response.payload : '',
        })
      }
      sendResponse(res, response)
      const tend = performance.now()
      logRequest({ t1: tstart, t2: tend, reqDetail })
    } catch (err) {
      const reqDetail = {
        method: req.method,
        path: req.url
      }
      if (err instanceof Error) {
        this.errorHandler(err, res, reqDetail)
      } else {
        console.error(err)
      }
      const tend = performance.now()
      logRequest({ t1: tstart, t2: tend, reqDetail })
    }
  }

  errorHandler (err: Error, res: ServerResponse, detail: RequestDetail): void {
    console.error(err)
    let error
    if (!(err instanceof ServerError)) {
      error = new ServerError({
        detail: JSON.stringify(detail),
        error: err instanceof Error ? err : undefined
      })
    } else {
      error = err
    }
    this.emit('error', error)
    defaultErrorHandler(error, res)
  }
}
