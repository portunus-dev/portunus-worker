jest.mock('../modules/db')
const deta = require('../modules/db')

jest.mock('../modules/teams')
const teamModule = require('../modules/teams')

jest.mock('../modules/users')
const userModule = require('../modules/users')

jest.mock('../modules/projects')
const projectModule = require('../modules/projects')

jest.mock('../modules/envs')
const envModule = require('../modules/envs')

jest.mock('../modules/audit')
const auditModule = require('../modules/audit')

const ResponseTest = require('../ResponseTest')

const {
  listAll,
  updateTeamName,
  updateTeamAudit,
  deleteTeam,
  listUsers,
  getUser,
  createUser,
  updateUserGPGPublicKey,
  updateUserAudit,
  addUserToTeam,
  removeUserFromTeam,
  addUserToAdmin,
  removeUserFromAdmin,
  // deleteUser,
  listProjects,
  createProject,
  updateProjectName,
  deleteProject,
  listStages,
  createStage,
  deleteStage,
  updateStageVars,
  getEnv,
  getAuditHistory,
} = require('../handlers')

const { sanitizeUser } = require('../modules/utils')

beforeAll(() => {
  global.Response = ResponseTest
})

describe('Handlers!', () => {
  test('listAll returns teams, project, stages for user', async () => {
    const user = { teams: ['team1'], admins: [] }
    const team1 = { name: 'team1', key: 'team1' }
    const project1 = {
      team: 'team1',
      project: 'project1',
      key: 'team1::project1',
    }
    const project2 = {
      team: 'team2',
      project: 'project2',
      key: 'team2::project2',
    }
    const projectList = [project1, project2]

    const stage1 = {
      stage: 'stage1',
      project: 'team1::project1',
      key: 'team1::project1::stage1',
    }
    const stage2 = {
      stage: 'stage2',
      project: 'team1::project1',
      key: 'team1::project1::stage2',
    }
    const stage3 = {
      stage: 'stage3',
      project: 'team2::project2',
      key: 'team2::project2::stage3',
    }
    const stageList = [stage1, stage2, stage3]

    teamModule.listTeams.mockResolvedValue([team1])
    deta.fetchMock
      .mockImplementationOnce(async (query) => {
        return {
          items: projectList.filter((o) => o.team === query.team),
        }
      })
      .mockImplementationOnce(async (_) => {
        return {
          items: stageList.filter((o) => o.project === project1.key),
        }
      })

    const response = await listAll({ user })
    expect(response.status).toEqual(200)
    const body = response.getBody()
    expect(body.teams[0]).toEqual(team1)
    expect(body.projects[0]).toEqual(project1)
    expect(body.stages[0]).toEqual(stage1)
    expect(body.stages[1]).toEqual(stage2)
  })
  describe('Teams', () => {
    test('updateTeamName - should require team', async () => {
      const response = await updateTeamName({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('updateTeamName - should require team admin', async () => {
      const team = 'test'
      const response = await updateTeamName({
        user: { admins: [] },
        content: { team },
      })
      expect(response.status).toEqual(403)
    })
    test('updateTeamName - should return 200 response', async () => {
      const team = 'test'
      const response = await updateTeamName({
        user: { admins: [team] },
        content: { team },
      })
      expect(response.getBody().key).toEqual(team)
      expect(response.status).toEqual(200)
    })
    test('updateTeamAudit - should require audit parameter', async () => {
      const team = 'test'
      const response = await updateTeamAudit({
        user: { admins: [] },
        content: { team },
      })
      expect(response.status).toEqual(400)
    })
    test('updateTeamAudit - should require boolean value', async () => {
      const team = 'test'
      const response = await updateTeamAudit({
        user: { admins: [] },
        content: { team, audit: 'test' },
      })
      expect(response.status).toEqual(400)
    })
    test('updateTeamAudit - should require team', async () => {
      const response = await updateTeamAudit({
        user: {},
        content: { audit: true },
      })
      expect(response.status).toEqual(400)
    })
    test('updateTeamAudit - should require team admin', async () => {
      const team = 'test'
      const response = await updateTeamAudit({
        user: { admins: [] },
        content: { team, audit: true },
      })
      expect(response.status).toEqual(403)
    })
    test('updateTeamAudit - should return 200 response', async () => {
      const team = 'test'
      const response = await updateTeamAudit({
        user: { admins: [team] },
        content: { team, audit: true },
      })
      expect(response.getBody().key).toEqual(team)
      expect(response.status).toEqual(200)
    })
    test('deleteTeam - should require team', async () => {
      const response = await deleteTeam({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('deleteTeam - should require team admin', async () => {
      const team = 'test'
      const response = await deleteTeam({
        user: { admins: [] },
        content: { team },
      })
      expect(response.status).toEqual(403)
    })
    test('deleteTeam - should return 200 response', async () => {
      const team = 'test'
      const response = await deleteTeam({
        user: { admins: [team] },
        content: { team },
      })
      expect(response.getBody().key).toEqual(team)
      expect(response.status).toEqual(200)
    })
  })
  describe('Users', () => {
    test('listUsers - should require team', async () => {
      const response = await listUsers({ user: { teams: [] }, query: {} })
      expect(response.status).toEqual(400)
    })
    test('listUsers - should require team access', async () => {
      const team = 'test'
      const response = await listUsers({ user: { teams: [] }, query: { team } })
      expect(response.status).toEqual(403)
    })

    test('listUsers - should respond 200', async () => {
      const team = 'test'
      const response = await listUsers({
        user: { teams: [team] },
        query: { team },
      })
      expect(response.status).toEqual(200)
    })

    test('getUser - should sanitize user', async () => {
      const user = { teams: ['abc'], public_key: 'abcd' }
      const response = await getUser({
        user,
      })
      expect(response.status).toEqual(200)
      expect(JSON.parse(response.body)).toEqual({ user: sanitizeUser(user) })
    })

    test('createUser - should require email', async () => {
      const response = await createUser({
        content: {},
      })
      expect(response.status).toEqual(400)
    })

    test('createUser - should require valid email', async () => {
      const email = 'test'
      const response = await createUser({
        content: { email },
      })
      expect(response.status).toEqual(400)
    })

    test('createUser - should respond 200', async () => {
      const email = 'test@test.com'
      userModule.createUser.mockResolvedValue({ key: 'test' })
      const response = await createUser({
        content: { email },
      })
      expect(response.status).toEqual(200)
    })

    test('updateUserGPGPublicKey - should require public key', async () => {
      const response = await updateUserGPGPublicKey({
        content: {},
      })

      expect(response.status).toEqual(400)
    })

    test('updateUserGPGPublicKey - should require non-zero public key', async () => {
      const public_key = ''

      const response = await updateUserGPGPublicKey({
        content: { public_key },
      })

      expect(response.status).toEqual(400)
    })

    test('updateUserGPGPublicKey - should respond 200', async () => {
      const public_key = '123456'

      userModule.updateUser.mockResolvedValue({ key: 'test' })

      const response = await updateUserGPGPublicKey({
        user: {},
        content: { public_key },
      })

      expect(response.status).toEqual(200)
    })

    test('updateUserAudit - should require audit parameter', async () => {
      const response = await updateUserAudit({
        user: { admins: [] },
        content: {},
      })
      expect(response.status).toEqual(400)
    })
    test('updateUserAudit - should require boolean value', async () => {
      const response = await updateUserAudit({
        user: { admins: [] },
        content: { audit: 'test' },
      })
      expect(response.status).toEqual(400)
    })
    test('updateUserAudit - should respond 200 and update', async () => {
      let user = { admins: [], preferences: {} }
      userModule.updateUser.mockImplementationOnce(async (update) => {
        user = update
      })
      const response = await updateUserAudit({
        user,
        content: { audit: '1' },
      })
      expect(response.status).toEqual(200)
      expect(response.getBody().audit).toEqual(true)
      expect(user.preferences.audit).toEqual(true)
    })
    test('addUserToTeam - should require team', async () => {
      const response = await addUserToTeam({
        content: {},
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToTeam - should require email', async () => {
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await addUserToTeam({
        content: { team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToTeam - should require valid email', async () => {
      const userEmail = 'test'
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await addUserToTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToTeam - should require admin access', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await addUserToTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(403)
    })
    test('addUserToTeam - creates new user if not found', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [team],
      }

      global.USERS = { get: jest.fn(() => false) }

      const response = await addUserToTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(200)
    })
    test('addUserToTeam - should respond 200', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [team],
      }
      const userToAdd = {
        key: 'test-key',
        email: userEmail,
      }

      global.USERS = { get: jest.fn(() => userToAdd) }

      const response = await addUserToTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(200)
    })
    test('removeUserFromTeam - should require team', async () => {
      const response = await removeUserFromTeam({
        content: {},
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromTeam - should require email', async () => {
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await removeUserFromTeam({
        content: { team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromTeam - should require valid email', async () => {
      const userEmail = 'test'
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await removeUserFromTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromTeam - should require admin access', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [],
      }

      const response = await removeUserFromTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(403)
    })
    test('removeUserFromTeam - should require valid USERS entry', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [team],
      }

      global.USERS = { get: jest.fn(() => false) }

      const response = await removeUserFromTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromTeam - should respond 200', async () => {
      const userEmail = 'test@test.com'
      const team = 'newTeam'
      const user = {
        admins: [team],
      }
      const userToAdd = {
        key: 'test-key',
        email: userEmail,
      }

      global.USERS = { get: jest.fn(() => userToAdd) }

      const response = await removeUserFromTeam({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(200)
    })
    test('addUserToAdmin - should require team', async () => {
      const response = await addUserToAdmin({
        content: {},
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToAdmin - should require email', async () => {
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await addUserToAdmin({
        content: { team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToAdmin - should require valid email', async () => {
      const userEmail = 'test'
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await addUserToAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToAdmin - should require admin access', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await addUserToAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(403)
    })
    test('addUserToAdmin - should require valid USERS entry', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [team],
      }

      global.USERS = { get: jest.fn(() => false) }

      const response = await addUserToAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('addUserToAdmin - should respond 200', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [team],
      }
      const userToAdd = {
        key: 'test-key',
        email: userEmail,
      }

      global.USERS = { get: jest.fn(() => userToAdd) }

      const response = await addUserToAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(200)
    })
    test('removeUserFromAdmin - should require team', async () => {
      const response = await removeUserFromAdmin({
        content: {},
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromAdmin - should require email', async () => {
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await removeUserFromAdmin({
        content: { team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromAdmin - should require valid email', async () => {
      const userEmail = 'test'
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await removeUserFromAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromAdmin - should require admin access', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [],
      }

      const response = await removeUserFromAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(403)
    })
    test('removeUserFromAdmin - should require valid USERS entry', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [team],
      }

      global.USERS = { get: jest.fn(() => false) }

      const response = await removeUserFromAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(400)
    })
    test('removeUserFromAdmin - should respond 200', async () => {
      const userEmail = 'test@test.com'
      const team = 'newAdmin'
      const user = {
        admins: [team],
      }
      const userToAdd = {
        key: 'test-key',
        email: userEmail,
      }

      global.USERS = { get: jest.fn(() => userToAdd) }

      const response = await removeUserFromAdmin({
        content: { userEmail, team },
        user,
      })

      expect(response.status).toEqual(200)
    })
  })

  describe('Project', () => {
    test('listProjects - should require team access', async () => {
      const team = 'test'
      const response = await listProjects({
        query: { team },
        user: { teams: ['another'] },
      })
      expect(response.status).toEqual(403)
    })
    test('listProjects - should default to user.teams[0]', async () => {
      const response = await listProjects({
        query: {},
        user: { teams: ['test'] },
      })
      expect(response.status).toEqual(200)
    })
    test('createProject - should require team', async () => {
      const response = await createProject({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('createProject - should require team access', async () => {
      const team = 'test'
      const response = await createProject({
        user: { teams: [], admins: [] },
        content: { team },
      })
      expect(response.status).toEqual(403)
    })
    test('createProject - should return 200 response', async () => {
      const team = 'test'
      const resp = { key: 'test' }
      projectModule.createProject.mockResolvedValue(resp)

      const response = await createProject({
        user: { teams: [team] },
        content: { team },
      })

      expect(response.getBody()).toEqual(resp)
      expect(response.status).toEqual(200)
    })
    test('updateProjectName - should require project', async () => {
      const response = await updateProjectName({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('updateProjectName - should require team admin', async () => {
      const project = 'test::toast'
      const response = await updateProjectName({
        user: { admins: [] },
        content: { project },
      })
      expect(response.status).toEqual(403)
    })
    test('updateProjectName - should return 200 response', async () => {
      const project = 'test::toast'
      const response = await updateProjectName({
        user: { admins: ['test'] },
        content: { project },
      })
      expect(response.getBody().key).toEqual(project)
      expect(response.status).toEqual(200)
    })
    test('deleteProject - should require project', async () => {
      const response = await deleteProject({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('deleteProject - should require team admin', async () => {
      const project = 'test::toast'
      const response = await deleteProject({
        user: { admins: [] },
        content: { project },
      })
      expect(response.status).toEqual(403)
    })
    test('deleteProject - should return 200 response', async () => {
      const project = 'test::toast'
      const response = await deleteProject({
        user: { admins: ['test'] },
        content: { project },
      })
      expect(response.getBody().key).toEqual(project)
    })
  })
  describe('Stages', () => {
    test('listStages - should require team', async () => {
      const response = await listStages({ user: {}, query: {} })
      expect(response.status).toEqual(400)
    })
    test('listStages - should require project', async () => {
      const team = 'test'
      const response = await listStages({ user: {}, query: { team } })
      expect(response.status).toEqual(400)
    })
    test('listStages - should require team access', async () => {
      const team = 'test'
      const project = 'test'
      const response = await listStages({
        user: { teams: [] },
        query: { team, project },
      })
      expect(response.status).toEqual(403)
    })
    test('listStages - should respond 200', async () => {
      const team = 'test'
      const project = 'test'
      const response = await listStages({
        user: { teams: [team] },
        query: { team, project },
      })
      expect(response.status).toEqual(200)
    })
    test('createStage - should require team', async () => {
      const response = await createStage({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('createStage - should require project', async () => {
      const team = 'test'
      const response = await createStage({ user: {}, content: { team } })
      expect(response.status).toEqual(400)
    })
    test('createStage - should require team access', async () => {
      const team = 'test'
      const project = 'test'
      const response = await createStage({
        user: { teams: [] },
        content: { team, project },
      })
      expect(response.status).toEqual(403)
    })
    test('createStage - should respond 200', async () => {
      const team = 'test'
      const project = 'test'
      const response = await createStage({
        user: { teams: [team] },
        content: { team, project },
      })
      expect(response.status).toEqual(200)
    })
    test('deleteStage - should require stage', async () => {
      const response = await deleteStage({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('deleteStage - should require admin access', async () => {
      const stage = 'test::test::test'
      const response = await deleteStage({
        user: { admins: [] },
        content: { stage },
      })
      expect(response.status).toEqual(403)
    })
    test('deleteStage - should respond 200', async () => {
      const stage = 'test::test::test'

      const response = await deleteStage({
        user: { admins: ['test'] },
        content: { stage },
      })
      expect(response.status).toEqual(200)
    })
    test('updateStageVars - should require stage', async () => {
      const response = await updateStageVars({ user: {}, content: {} })
      expect(response.status).toEqual(400)
    })
    test('updateStageVars - should require team access', async () => {
      const stage = 'test::test::test'
      const response = await updateStageVars({
        user: { teams: [] },
        content: { stage },
      })
      expect(response.status).toEqual(403)
    })
    test('updateStageVars - should respond 200', async () => {
      const stage = 'test::test::test'

      const response = await updateStageVars({
        user: { teams: ['test'] },
        content: { stage },
      })
      expect(response.status).toEqual(200)
    })
    // test('getEnv - should require team', async () => {
    //   const response = await getEnv({ user: {}, query: {} })
    //   expect(response.status).toEqual(400)
    // })
    test('getEnv - should require project', async () => {
      const team = 'test'
      const response = await getEnv({ user: {}, query: { team } })
      expect(response.status).toEqual(400)
    })
    test('getEnv - should require stage', async () => {
      const team = 'test'
      const project = 'test'
      const response = await getEnv({ user: {}, query: { team, project } })
      expect(response.status).toEqual(400)
    })
    test('getEnv - should require team access', async () => {
      const team = 'test'
      const project = 'test'
      const stage = 'test'
      const response = await getEnv({
        user: { teams: [] },
        query: { team, project, stage },
      })
      expect(response.status).toEqual(403)
    })
    test('getEnv - should respond 200', async () => {
      const team = 'test'
      const project = 'test'
      const stage = 'test'

      envModule.getEncryptedKVEnvs.mockImplementationOnce(() => ({
        encrypted: true,
        vars: {},
      }))

      const response = await getEnv({
        user: { teams: [team] },
        query: { team, project, stage },
      })

      expect(response.status).toEqual(200)
    })
  })
  describe('Audit', () => {
    test('getAuditHistory - should require type', async () => {
      const response = await getAuditHistory({ query: {} })
      expect(response.status).toEqual(400)
    })
    test('getAuditHistory - should require type to be "user" or "team"', async () => {
      const response = await getAuditHistory({ query: { type: 'project' } })
      expect(response.status).toEqual(400)
    })
    test('getAuditHistory - should require team member or admin', async () => {
      const response = await getAuditHistory({
        query: {
          type: 'team',
          key: 'abc',
        },
        user: { key: 'abc', teams: ['def'], admins: [] },
      })
      expect(response.status).toEqual(403)
    })
    test('getAuditHistory - should return team history', async () => {
      auditModule.getAuditHistory.mockResolvedValue({ auditHistory: [] })
      const response = await getAuditHistory({
        query: {
          type: 'team',
          key: 'abc',
        },
        user: { key: 'abc', teams: ['abc'], admins: [] },
      })

      expect(response.status).toEqual(200)
    })
    test('getAuditHistory - should return user history', async () => {
      auditModule.getAuditHistory.mockResolvedValue({ auditHistory: [] })
      const response = await getAuditHistory({
        query: {
          type: 'user',
          key: 'abc',
        },
        user: { key: 'abc', admins: [], teams: [] },
      })

      expect(response.status).toEqual(200)
    })
  })
})
