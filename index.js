const { Router } = require('itty-router')
const { withContent } = require('itty-router-extras')

const {
  root,
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
  withRequiredName,
} = require('./handlers')
const { corsHeaders, respondJSON } = require('./modules/utils')
const { withRequireUser } = require('./modules/auth')

const router = Router()

const withCors = (_) => {
  // TODO: could check in greater detail
  return new Response(null, { headers: { ...corsHeaders } })
}
router.options('*', withCors)

// UI
router.get('/all', withRequireUser, listAll)

router.get('/teams', withRequireUser, listTeams)
// router.get('/team', getTeam)
router.post('/team', withContent, withRequiredName('team'), withRequireUser, createTeam)
// router.put('/team/update', updateTeam)
// router.delete('/team/delete', deleteTeam)

router.get('/user', withRequireUser, ({ user }) => respondJSON(user))
router.get('/users', withRequireUser, listUsers)
// router.put('/user/team', addUserToTeam)
// router.put('/user/admin', addUserToAdmin)
// router.delete('/user/team', removeUserFromTeam)
// router.delete('/user/admin', removeUserFromAdmin)

router.get('/projects', withRequireUser, listProjects)
// router.get('/project', getProject)
router.put('/project', withContent, withRequiredName('project'), withRequireUser, createProject)
// router.put('/project/update', updateProject)
// router.delete('/project/delete', deleteProject)

router.get('/stages', withRequireUser, listStages)
// router.get('/stage', getStage)
router.put('/stage', withContent, withRequireUser('stage'), withRequireUser, createStage)
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
