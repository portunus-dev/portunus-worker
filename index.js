import { Router } from 'itty-router'
import { withContent } from 'itty-router-extras'

import {
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
} from './handlers'
import { corsHeaders, respondJSON, respondError } from './modules/utils'
import { withRequireUser } from './modules/auth'
<<<<<<< HEAD
import { withLogging, minimalLog } from './modules/audit'
=======
import deta from './modules/db'
import {
  withLogging,
  minimalLog,
  convertRequestToHumanReadableString,
} from './modules/audit'
>>>>>>> Audit - explanation string and insert logs to deta

const router = Router()

router.all('*', withLogging)

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
router.all('/', root)

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
  event.respondWith(
    router
      .handle(event.request)
      .catch(respondError)
      .finally(async () => {
        if (event.request.method !== 'OPTIONS') {
          const email = event.request.user && event.request.user.email
          const {
            team = event.request.user &&
              event.request.user.teams &&
              event.request.user.teams[0],
            project,
            stage,
          } = {
            ...(event.request.query || {}),
            ...(event.request.content || {}),
          }
          const keys = {
            email,
            team,
            project:
              project && project.indexOf('::') > 0
                ? project
                : `${team}::${project}`,
            stage:
              stage && stage.indexOf('::') > 0
                ? stage
                : `${team}::${project}::${stage}`,
          }

          const stripped = event.request.url.replace('https://', '')
          const pathIdx = stripped.indexOf('/')
          const apiPath =
            stripped.substring(pathIdx + 1).split('?')[0] +
            '!'.replace('s!', '').replace('!', '')

          const explanation = convertRequestToHumanReadableString({
            url: event.request.url,
            apiPath,
            method: event.request.method,
            query: event.request.query,
            params: event.request.content,
          })

          const log = {
            content: event.request.content,
            api_path: apiPath,
            explanation,
            // minimal logging
            user: event.request.user,
            end: Date.now(),
            ...minimalLog(event.request),
            // middleware dictated additional logging
            ...event.request._log,
            // minimal keys required for processing
            ...keys,
          }
          deta.Base('audit_logs').put(log, null, { expireIn: 60 * 24 }) // expireIn seconds
        }
      })
  )
)
