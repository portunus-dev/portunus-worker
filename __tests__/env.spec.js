jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  getStage,
  getKVEnvs,
  createStage,
  listStages,
  updateStageVars,
  deleteStage,
} = require('../modules/envs')

beforeEach(() => {
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Stages Module', () => {
  test('createStage successfully creates the stage', async () => {
    const team = 'test'
    const project = 'test'
    const stage = 'test'

    const DETA = {}
    deta.putMock.mockImplementation((x) => (DETA[x.key] = x))
    await createStage({ team, project, stage })
    const key = `${team}::${project}::${stage}`
    const newStage = DETA[key]

    expect(deta.putMock).toBeCalledTimes(1)

    expect(newStage.key).toEqual(key)
    expect(newStage.team).toEqual(team)
    expect(newStage.project).toEqual(`${team}::${project}`)
    expect(newStage.stage).toEqual(stage)
    expect(newStage.vars).toEqual(0)
  })
  test('getStages returns value from DB', async () => {
    const team = 'test-key'
    const project = 'test-key'
    const stage = 'test-key'
    const dbStage = await getStage({ team, project, stage })

    expect(dbStage.key).toEqual(`${team}::${project}::${stage}`)
  })
  test('updateStageVars processes updates and returns number of changes', async () => {
    const stage = 'test-key::test-key::test-key'
    const updates = {
      add: { new: 1 },
      edit: { existing: 1 },
      remove: ['delete'],
    }

    const KV_STORE = {
      'test-key::test-key::test-key': {
        existing: 0,
        delete: 0,
      },
    }

    global.KV = {
      get: (key) => KV_STORE[key],
      put: (key, value) => (KV_STORE[key] = JSON.parse(value)),
    }

    const numberOfChanges = await updateStageVars({ stage, updates })

    expect(numberOfChanges).toEqual(3)
    expect(deta.updateMock).toBeCalledTimes(0)
    expect(KV_STORE[stage].delete).toBeUndefined()
    expect(KV_STORE[stage].existing).toEqual(1)
    expect(KV_STORE[stage].new).toEqual(1)
  })
  test('updateStageVars should update var count when it is not 0', async () => {
    const stage = 'test-key::test-key::test-key'
    const updates = {
      add: { new: 1 },
    }

    const KV_STORE = {
      'test-key::test-key::test-key': {
        existing: 0,
        delete: 0,
      },
    }

    global.KV = {
      get: (key) => KV_STORE[key],
      put: (key, value) => (KV_STORE[key] = JSON.parse(value)),
    }

    const numberOfChanges = await updateStageVars({ stage, updates })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(numberOfChanges).toEqual(1)
    expect(KV_STORE[stage].new).toEqual(1)
  })
  test('deleteStage should delete stage in Deta & KV', async () => {
    const stage = { key: 'test-key::test-key::test-key' }

    const KV_STORE = { 'test-key::test-key::test-key': true }
    global.KV = { delete: jest.fn((key) => delete KV_STORE[key]) }

    const DETA = {
      [stage.key]: true,
    }
    deta.deleteMock.mockImplementationOnce((stage) => delete DETA[stage])

    await deleteStage(stage.key)

    expect(deta.deleteMock).toBeCalledTimes(1)
    expect(KV_STORE[stage.key]).toBeUndefined()
    expect(DETA[stage.key]).toBeUndefined()
  })
})
