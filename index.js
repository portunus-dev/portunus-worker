import { Router } from 'itty-router'
import { withContent } from 'itty-router-extras'

const {
  root,
  listTeams,
  createTeam,
  deleteTeam,
  updateTeamName,
  listProjects,
  createProject,
  updateProjectName,
  deleteProject,
  listStages,
  createStage,
  updateStageVars,
  deleteStage,
  listUsers,
  createUser,
  deleteUser,
  addUserToTeam,
  removeUserFromTeam,
  addUserToAdmin,
  removeUserFromAdmin,
  listAll,
  getToken,
  getOTP,
  login,
  getEnv,
  withRequiredName,
} = require('./handlers')
const { corsHeaders, respondJSON, respondError } = require('./modules/utils')
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
router.post(
  '/team',
  withContent,
  withRequiredName('team'),
  withRequireUser,
  createTeam
)

router.delete('/team', withContent, withRequireUser, deleteTeam)

router.put(
  '/team',
  withContent,
  withRequiredName('team'),
  withRequireUser,
  updateTeamName
)

router.get('/users', withRequireUser, listUsers)
router.get('/user', withRequireUser, ({ user }) =>
  respondJSON({ payload: { user } })
)
router.post('/user', withContent, createUser)
router.put('/user/team', withContent, withRequireUser, addUserToTeam)
router.delete('/user/team', withContent, withRequireUser, removeUserFromTeam)
router.put('/user/admin', withContent, withRequireUser, addUserToAdmin)
router.delete('/user/admin', withContent, withRequireUser, removeUserFromAdmin)
router.delete('/user', withRequireUser, deleteUser)

router.get('/projects', withRequireUser, listProjects)
// router.get('/project', getProject)
router.post(
  '/project',
  withContent,
  withRequiredName('project'),
  withRequireUser,
  createProject
)
router.put(
  '/project',
  withContent,
  withRequiredName('project'),
  withRequireUser,
  updateProjectName
)
router.delete('/project', withContent, withRequireUser, deleteProject)

router.get('/stages', withRequireUser, listStages)
// router.get('/stage', getStage)
router.post(
  '/stage',
  withContent,
  withRequiredName('stage'),
  withRequireUser,
  createStage
)
router.delete('/stage', withContent, withRequireUser, deleteStage)

// TODO: env vs vars
router.get('/env', withRequireUser, getEnv)
router.put('/env', withContent, withRequireUser, updateStageVars)

// router.get('/vars', listVars)
// router.get('/var', getVar)
// router.put('/var', createVar)
// router.put('/var/update', updateVar)
// router.delete('/var/delete', deleteVar)

// auth
router.get('/otp', getOTP)
router.get('/login', login)
router.get('/token', getToken) // legacy direct JWT email route
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
  event.respondWith(router.handle(event.request).catch(respondError))
)
