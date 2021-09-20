import { ServerWorker } from '@/server/server-worker'
import { TLSSocket } from 'tls'
import { readFileSync } from 'fs'
import {
  createSecureServer, Http2Server, Http2ServerRequest, Http2ServerResponse
} from 'http2'

import { UploadController } from '@/server/upload/upload-controller'

export class WriteWorker extends ServerWorker {
  #server: Http2Server

  #port: number

  #uploadController: UploadController

  constructor ({ port }: { port: number }) {
    super({
      type: 'WriteWorker',
      events: ['created', 'start', 'stop']
    })
    const options = {
      key: readFileSync('@/../key.pem'),
      cert: readFileSync('@/../cert.pem'),
      allowHTTP1: true
    }

    this.#server = createSecureServer(options)
    this.#port = port
    this.#server.on('request', this.serverListener.bind(this))
    this.#uploadController = new UploadController({
      uploadPath: 'upload',
      timeout: 10000,
      capacity: 5
    })
    this.#uploadController.on('error', err => {
      console.log(err)
    })
  }

  // eslint-disable-next-line class-methods-use-this
  private serverListener (req: Http2ServerRequest, res: Http2ServerResponse): void {
    const { method } = req
    const path = req.url

    if (method.toLowerCase() !== 'post' || path !== '/upload') {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Forbidden'
      }))
      return
    }

    if (req.httpVersion === '2.0') {
      const socket = req.stream.session.socket as TLSSocket
      const { stream } = res
      stream.respond({
        'content-type': 'application/json',
        ':status': 200
      })
      stream.end(JSON.stringify({
        alpnProtocol: socket.alpnProtocol,
        httpVersion: req.httpVersion
      }))
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.#uploadController.upload(req)
        .then(result => {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({
            result: result.map(el => ({
              path: el.relativePath,
              content: el.content.toString(),
              contentType: el.contentType
            }))
          }))
        })
        .catch(err => {
          res.writeHead(500, { 'content-type': 'application/json' })
          res.end(JSON.stringify({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            error: err
          }))
        })
    }
  }

  async start (): Promise<void> {
    await this.#uploadController.start()
    this.#server.listen(this.#port)
  }

  async stop (): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close(err => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }

  async destroy (): Promise<void> {
    await this.stop()
  }
}
