jest.mock('../modules/db')
const deta = require('../modules/db')

jest.mock('../modules/teams')
const teamModule = require('../modules/teams')

jest.mock('../modules/users')
const userModule = require('../modules/users')

const ResponseTest = require('../ResponseTest')

const {
  listAll,
  listTeams,
  createTeam,
  updateTeamName,
  deleteTeam,
  listUsers,
  createUser,
  addUserToTeam,
  removeUserFromTeam,
  addUserToAdmin,
  removeUserFromAdmin,
  deleteUser,
} = require('../handlers')

beforeAll(() => {
  global.Response = ResponseTest
})

describe('Handlers!', () => {
  test('listAll returns teams, project, stages for user', async () => {
    const user = { teams: ['team1'] }
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

    teamModule.getTeam.mockResolvedValue(team1)
    deta.fetchMock
      .mockImplementationOnce(async (query) => {
        return {
          items: projectList.filter((o) => o.team === query.team),
        }
      })
      .mockImplementationOnce(async (query) => {
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
    test('updateTeamName - should require team admin', async () => {
      const team = 'test'
      const response = await updateTeamName({
        user: { admins: [team] },
        content: { team },
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
    test('deleteTeam - should require team admin', async () => {
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
    test('addUserToTeam - should require valid USERS entry', async () => {
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

      expect(response.status).toEqual(400)
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
})
