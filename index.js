const Router = require('./router')
const { root, getToken, getEnv } = require('./handlers')

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const r = new Router()

  r.get('/token', getToken)
  r.get('/env', getEnv)
  r.get('/', root)

  const resp = await r.route(request)
  return resp
}
