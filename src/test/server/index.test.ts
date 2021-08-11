import { ServerResponse, IncomingMessage } from 'http'
import { defaultErrorHandler, sendResponse, getRequestDetail } from '../../server'
import { ServerError } from '../../error'

describe('defaultErrorHandler test case', () => {
  test('Should write headers and send the responce to the client', () => {
    const code = 500
    const error = new ServerError({ code, message: 'test' })
    const writeHeadSpy = jest.fn()
    const endSpy = jest.fn()
    const res = {
      writeHead: writeHeadSpy,
      end: endSpy
    } as any as ServerResponse

    defaultErrorHandler(error, res)
    expect(writeHeadSpy).toBeCalledWith(code, {
      'Content-Type': 'application/json'
    })
    expect(endSpy).toBeCalledWith(JSON.stringify(error))
  })
})

describe('sendResponse test case', () => {
  test('Should write headers and send the responce to the client', () => {
    const response = {
      code: 200,
      payload: 'test'
    }
    const writeHeadSpy = jest.fn()
    const endSpy = jest.fn()
    const res = {
      writeHead: writeHeadSpy,
      end: endSpy
    } as any as ServerResponse

    sendResponse(res, response)
    expect(writeHeadSpy).toBeCalledWith(response.code, {
      'Content-Type': 'text/plain'
    })
    expect(endSpy).toBeCalledWith(response.payload)
  })
})

describe('getRequestDetail test case', () => {
  test('Should return valid value if the method is GET', () => {
    const req = {
      url: '/login',
      method: 'GET'
    } as any as IncomingMessage

    const result = getRequestDetail(req)
    expect(result).toEqual({
      path: '/login',
      method: 'get'
    })
  })

  test('Should throw if method is not GET', () => {
    const req = {
      url: '/login',
      method: 'POST'
    } as unknown as IncomingMessage

    try {
      getRequestDetail(req)
    } catch (err) {
      expect(err).toBeInstanceOf(ServerError)
      expect(err).toEqual(new ServerError({ code: 403, message: 'Method not alowed' }))
    }
  })
})
