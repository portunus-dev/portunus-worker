jest.mock('deta-worker')
const deta = require('deta-worker')

// TODO any good places or utils for this? e.g. represent data in a useful way no-data-key, data-key
const TEST_DB = {
  teams: {
    'test-key': {
      key: 'test-key',
      name: 'test-team',
    },
    'test-key2': {
      key: 'test-key2',
      name: 'test-team2',
    },
  },
  projects: {
    'test-key::test-key': {
      key: 'test-key::test-key',
      team: 'test-key',
      project: 'test-key',
      name: 'test-project',
    },
    'test-key2::test-key2': {
      key: 'test-key2::test-key2',
      team: 'test-key2',
      project: 'test-key2',
    },
  },
  stages: {
    'test-key::test-key::test-key': {
      key: 'test-key::test-key::test-key',
      project: 'test-key::test-key',
      stage: 'test-key',
      vars: 1,
    },
    'test-key2::test-key2::test-key2': {
      key: 'test-key2::test-key2::test-key2',
      project: 'test-key2::test-key2',
      stage: 'test-key2',
      vars: 1,
    },
  },
  users: {
    'test-key': {
      key: 'test-key',
      email: 'test-email',
      teams: ['test-key', 'someTeam'],
      admins: ['test-key', 'someTeam'],
    },
    'test-key2': {
      key: 'test-key2',
      email: 'test-email2',
      teams: ['test-key'],
      admins: ['test-key'],
    },
  },
}

const getMock = jest.fn(async (key, db) => await TEST_DB[db][key])
const fetchMock = jest.fn()
const insertMock = jest.fn(async (entry, db) => {
  const key = entry.key || Date.now().toString().substring(0, 12)
  if (TEST_DB[db][key]) throw new Error('Deta insert - key already exists')
  const value = { ...entry, key }
  TEST_DB[db][key] = value
  return value
})
const putMock = jest.fn(async (_updates, key, _db) => {
  const finalKey = key || Date.now().toString().substring(0, 12)
  return { key: finalKey }
})

const updateMock = jest.fn(async (updates, key, db) => {
  if (!key) throw new Error('No key for Deta Update')
  // NOTE: this mutates the base DB
  // TODO: is there a way to easily get persisted updates without the mutation? i.e. can I clear it per test
  // TODO: it doesn't enforce existing entry
  TEST_DB[db] = {
    ...TEST_DB[db],
    [key]: {
      ...TEST_DB[db][key],
      ...updates,
    },
  }
  return null
})
const deleteMock = jest.fn()

const mockedDbApi = jest.fn((db) => ({
  insert: (entry) => insertMock(entry, db),
  get: (key) => getMock(key, db),
  fetch: (query) => fetchMock(query, db),
  put: (updates, key) => putMock(updates, key, db),
  update: (updates, key) => updateMock(updates, key, db),
  delete: (key) => deleteMock(key, db),
  util: { append: jest.fn(), increment: jest.fn() },
}))

deta.Base.mockImplementation(mockedDbApi)

module.exports = deta
module.exports.TEST_DB = TEST_DB
module.exports.insertMock = insertMock
module.exports.getMock = getMock
module.exports.fetchMock = fetchMock
module.exports.putMock = putMock
module.exports.updateMock = updateMock
module.exports.deleteMock = deleteMock
