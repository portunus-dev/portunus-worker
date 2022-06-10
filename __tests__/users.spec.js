jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  // getUser,
  createUser,
  addUserToTeam,
  removeUserFromTeam,
  addUserToAdmin,
  removeUserFromAdmin,
  deleteUser,
  // getAuditForUser,
} = require('../modules/users')

beforeEach(() => {
  deta.insertMock.mockClear()
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Users Module', () => {
  test('createUser successfully creates user', async () => {
    const email = 'test-email'

    const USER_STORE = {}
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    const dbUser = await createUser(email)

    expect(dbUser.key).not.toBeNull()
    expect(deta.insertMock).toBeCalledTimes(1)
    expect(global.USERS.put).toBeCalledTimes(1)
    expect(USER_STORE[email]).not.toBeUndefined()
    expect(JSON.parse(USER_STORE[email]).key).not.toBeUndefined()
  })
  test('addUserToTeam successfully adds team', async () => {
    const user = {
      key: 'test-key',
      email: 'test-email',
      teams: [],
      admins: [],
    }
    const team = 'new-team'

    const USER_STORE = { [user.email]: user }
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    await addUserToTeam({ user, team })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(global.USERS.put).toBeCalledTimes(1)

    const kvUser = JSON.parse(USER_STORE[user.email])
    expect(kvUser.teams.includes(team)).toBe(true)
  })
  test('removeUserFromTeam removes from teams and admins', async () => {
    const user = {
      key: 'test-key',
      email: 'test-email',
      teams: ['new-team'],
      admins: ['new-team'],
    }
    const team = 'new-team'

    const USER_STORE = { [user.email]: user }
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    await removeUserFromTeam({ user, team })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(global.USERS.put).toBeCalledTimes(1)

    const kvUser = JSON.parse(USER_STORE[user.email])
    expect(kvUser.teams.includes(team)).toBe(false)
    expect(kvUser.admins.includes(team)).toBe(false)
  })
  test('addUserToAdmin successfully adds team', async () => {
    const user = {
      key: 'test-key',
      email: 'test-email',
      teams: [],
      admins: [],
    }
    const team = 'new-team'

    const USER_STORE = { [user.email]: user }
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    await addUserToAdmin({ user, team })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(global.USERS.put).toBeCalledTimes(1)

    const kvUser = JSON.parse(USER_STORE[user.email])
    expect(kvUser.admins.includes(team)).toBe(true)
    expect(kvUser.teams.includes(team)).toBe(false)
  })
  test('removeUserFromAdmin removes from admins only', async () => {
    const user = {
      key: 'test-key',
      email: 'test-email',
      teams: ['new-team'],
      admins: ['new-team'],
    }
    const team = 'new-team'

    const USER_STORE = { [user.email]: user }
    global.USERS = { put: jest.fn((key, value) => (USER_STORE[key] = value)) }

    await removeUserFromAdmin({ user, team })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(global.USERS.put).toBeCalledTimes(1)

    const kvUser = JSON.parse(USER_STORE[user.email])
    expect(kvUser.teams.includes(team)).toBe(true)
    expect(kvUser.admins.includes(team)).toBe(false)
  })
  test('deleteUser requires user.key', async () => {
    const user = {
      email: 'test-email',
      teams: ['new-team'],
      admins: ['new-team'],
    }

    expect(() => deleteUser(user)).toThrow()
  })
  test('deleteUser requires user.email', async () => {
    const user = {
      key: 'test-key',
      teams: ['new-team'],
      admins: ['new-team'],
    }

    expect(() => deleteUser(user)).toThrow()
  })
  test('deleteUser successfully removes from KV and Deta', async () => {
    const user = {
      key: 'test-key',
      email: 'test-email',
      teams: ['new-team'],
      admins: ['new-team'],
    }

    const DETA = { [user.key]: user }
    deta.deleteMock.mockImplementation((key) => delete DETA[key])

    const USER_STORE = { [user.email]: user }
    global.USERS = {
      delete: jest.fn((key) => delete USER_STORE[key]),
    }

    await deleteUser(user)

    expect(deta.deleteMock).toBeCalledTimes(1)
    expect(global.USERS.delete).toBeCalledTimes(1)

    expect(DETA[user.key]).toBeUndefined()
    expect(USER_STORE[user.email]).toBeUndefined()
  })
})
