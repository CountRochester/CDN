import { CDNServer, CDNResponse } from './server'

function serverHandler (route: string): Promise<CDNResponse> {
  console.log(route)
  return new Promise(resolve => {
    resolve({
      code: 200,
      payload: route
    })
  })
}

const server = new CDNServer({ handler: serverHandler })

server.start()
  .then(() => {
    console.log('Server started OK')
  })
  .catch(err => {
    console.error(err)
  })
