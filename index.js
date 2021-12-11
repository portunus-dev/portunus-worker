const Router = require('./router')
const { root, getUser, listProjects, listUsers, getToken, getEnv } = require('./handlers')
const { corsHeaders } = require('./modules/utils')

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const r = new Router()

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders } })
  }

  // UI
  r.get('/user', getUser)
  r.get('/projects', listProjects)
  r.get('/users', listUsers)
  // CLI
  r.get('/token', getToken)
  r.get('/env', getEnv)
  r.get('/', root)

  const resp = await r.route(request)
  return resp
}
