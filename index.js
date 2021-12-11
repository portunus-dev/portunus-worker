import { Router } from 'itty-router'
import { withContent } from 'itty-router-extras'

const {
  root,
  getUser,
  listTeams,
  createTeam,
  listProjects,
  createProject,
  listStages,
  createStage,
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
router.get('/all', listAll)

router.get('/teams', listTeams)
// router.get('/team', getTeam)
router.post('/team', withContent, createTeam)
// router.put('/team/update', updateTeam)
// router.delete('/team/delete', deleteTeam)

router.get('/user', getUser)
router.get('/users', listUsers)
// router.put('/user/team', addUserToTeam)
// router.put('/user/admin', addUserToAdmin)
// router.delete('/user/team', removeUserFromTeam)
// router.delete('/user/admin', removeUserFromAdmin)

router.get('/projects', listProjects)
// router.get('/project', getProject)
router.put('/project', withContent, createProject)
// router.put('/project/update', updateProject)
// router.delete('/project/delete', deleteProject)

router.get('/stages', listStages)
// router.get('/stage', getStage)
router.put('/stage', withContent, createStage)
// router.put('/stage/update', updateStage)
// router.delete('/stage/delete', deleteStage)

router.get('/env', getEnv)
// router.get('/vars', listVars)
// router.get('/var', getVar)
// router.put('/var', createVar)
// router.put('/var/update', updateVar)
// router.delete('/var/delete', deleteVar)

// CLI
router.get('/token', getToken)
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
