jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  getTeam,
  createTeam,
  listTeams,
  updateTeamName,
  updateTeamAudit,
  deleteTeam,
} = require('../modules/teams')

beforeEach(() => {
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Teams Module', () => {
  test('createTeam successfully creates team, updates USERs stores and returns team id', async () => {
    const name = 'test'
    const user = {
      key: 'test-user',
      email: 'test-email',
      teams: [],
      admins: [],
    }

    const USER_STORE = {}
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    const teamId = await createTeam({ name, user })

    expect(teamId).not.toBeNull()
    expect(deta.updateMock).toBeCalledTimes(2)
    expect(global.USERS.put).toBeCalledTimes(2)
    expect(USER_STORE[user.email]).not.toBeNull()
    const jsonUser = JSON.parse(USER_STORE[user.email])
    expect(jsonUser.teams.includes(teamId)).toEqual(true)
    expect(jsonUser.admins.includes(teamId)).toEqual(true)
  })
  test('listTeams pulls team/admin info and flattens', async () => {
    const user = { teams: ['test-key', 'test-key2'], admins: ['test-key'] }

    const teams = await listTeams({ user })

    expect(teams.length).toEqual(2)
    expect(teams[1].admin).toEqual(true)
    expect(teams[1].key).toEqual('test-key')
    expect(teams[1].name).toEqual('test-team')
    expect(teams[0].admin).toEqual(false)
    expect(teams[0].key).toEqual('test-key2')
    expect(teams[0].name).toEqual('test-team2')
    expect(deta.getMock).toBeCalledTimes(2)
  })
  test('getTeams returns value from DB', async () => {
    const keyWithData = 'test-key'
    const team = await getTeam(keyWithData)

    expect(team.key).toEqual(keyWithData)
  })
  test('updateTeamName updates and returns key', async () => {
    const keyWithData = 'test-key'
    const newName = 'test1234'
    await updateTeamName({ name: newName, team: keyWithData })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(deta.TEST_DB.teams[keyWithData].name).toEqual(newName)
  })
  test('updateTeamAudit updates and returns key', async () => {
    const keyWithData = 'test-key'
    const newValue = 'test1234'
    await updateTeamAudit({ audit: false, team: keyWithData })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(deta.TEST_DB.teams[keyWithData].name).toEqual(newValue)
  })
  test('deleteTeam should delete stages, projects, team and update users', async () => {
    const teamToDelete = 'test-key'
    const project = { key: 'test-key::test-key' }
    const stage = { key: 'test-key::test-key::test-key' }
    const user = { ...deta.TEST_DB.users['test-key'] }

    const USER_STORE = {
      [user.email]: user,
    }
    global.USERS = {
      put: jest.fn((email, update) => {
        USER_STORE[email] = JSON.parse(update)
      }),
    }

    const KV_STORE = { 'test-key::test-key::test-key': true }
    global.KV = { delete: jest.fn((key) => delete KV_STORE[key]) }

    deta.fetchMock
      .mockResolvedValueOnce({ items: [project] })
      .mockResolvedValueOnce({ items: [stage] })
      .mockResolvedValueOnce({ items: [user] })

    await deleteTeam({ team: teamToDelete })

    expect(deta.fetchMock).toBeCalledTimes(3)
    expect(deta.deleteMock).toBeCalledTimes(3)
    expect(deta.updateMock).toBeCalledTimes(1)
    expect(KV_STORE[stage.key]).toBeUndefined()
    expect(deta.TEST_DB.users[user.key].teams.length).toEqual(1)
    expect(deta.TEST_DB.users[user.key].admins.length).toEqual(1)
    expect(USER_STORE[user.email].teams.length).toEqual(1)
    expect(USER_STORE[user.email].admins.length).toEqual(1)
    expect(USER_STORE[user.email].teams[0]).toEqual('someTeam')
    expect(USER_STORE[user.email].admins[0]).toEqual('someTeam')
  })
})
