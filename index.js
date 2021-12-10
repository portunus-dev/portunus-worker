import { Router } from 'itty-router'
const {
  root,
  getUser,
  listProjects,
  listUsers,
  listAll,
  getToken,
  getEnv,
} = require('./handlers')
const { corsHeaders } = require('./modules/utils')

const router = Router()

const withCors = (request) => {
  // TODO: could check in greater detail
  return new Response(null, { headers: { ...corsHeaders } })
}
router.options('*', withCors)

// UI
router.get('/user', getUser)
router.get('/projects', listProjects)
router.get('/users', listUsers)
router.get('/all', listAll)

// CLI
router.get('/token', getToken)
router.get('/env', getEnv)
router.get('/', root)

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
