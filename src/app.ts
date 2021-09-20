import 'module-alias/register'
import { WriteWorker } from '@/server/write-worker'

const server = new WriteWorker({ port: 2500 })

server.on('error', (err) => {
  console.log('Server error')
})

server.start()
  .then(() => {
    console.log('Server started OK')
  })
  .catch(err => {
    console.error(err)
  })
