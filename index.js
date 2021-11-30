import { Router } from 'itty-router'
const {
  root,
  getUser,
  listProjects,
  listUsers,
  getToken,
  getEnv,
} = require('./handlers')
const { corsHeaders } = require('./modules/utils')

const router = Router()

const withCors = (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders } })
  }
}

router.get('*', withCors)

// UI
router.get('/user', getUser)
router.get('/projects', listProjects)
router.get('/users', listUsers)
// CLI
router.get('/token', getToken)
router.get('/env', getEnv)
router.get('/', root)

router.post('/todos', async (request) => {
  const content = await request.json()

  return new Response('Creating Todo: ' + JSON.stringify(content))
})

// 404
router.all(
  '*',
  () =>
    new Response('resource not found', {
      status: 404,
      statusText: 'not found',
      headers: {
        'content-type': 'text/plain',
      },
    })
)

addEventListener('fetch', (event) =>
  event.respondWith(router.handle(event.request))
)
