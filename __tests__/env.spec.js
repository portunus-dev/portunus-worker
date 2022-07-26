jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  getStage,
  createStage,
  updateStageVars,
  deleteStage,
  getEncryptedKVEnvs,
} = require('../modules/envs')

beforeEach(() => {
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

const PGP_MESSAGE_START = '-----BEGIN PGP MESSAGE-----'

const ARMORED_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
R5vwj/6gJSINYRPxSzZVnStA
=3aeH
-----END PGP PUBLIC KEY BLOCK----- 
`

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

  describe('Env - KV Specific', () => {
    test('getEncryptedKVEnvs - should trim variables when UI is set', async () => {
      const team = 'test-key'
      const project = 'test-key'
      const stage = 'test-key'
      const user = { public_key: ARMORED_KEY }
      const ui = true

      const KV_STORE = {
        'test-key::test-key::test-key': {
          var1: 0,
          var2: 0,
        },
      }

      global.KV = {
        get: (key) => KV_STORE[key],
      }

      const { vars, encrypted } = await getEncryptedKVEnvs({
        team,
        project,
        stage,
        user,
        ui,
      })

      expect(encrypted).toEqual(false)
      expect(vars.var1).toEqual('')
      expect(vars.var2).toEqual('')
    })

    test('getEncryptedKVEnvs - should encrypt vars when public_key is set and UI is false', async () => {
      const team = 'test-key'
      const project = 'test-key'
      const stage = 'test-key'
      const user = { public_key: ARMORED_KEY }
      const ui = false

      const KV_STORE = {
        'test-key::test-key::test-key': {
          var1: 0,
          var2: 0,
        },
      }

      global.KV = {
        get: (key) => KV_STORE[key],
      }

      const { vars, encrypted } = await getEncryptedKVEnvs({
        team,
        project,
        stage,
        user,
        ui,
      })

      expect(vars.indexOf(PGP_MESSAGE_START)).toEqual(0)
      expect(encrypted).toEqual(true)
    })

    test('getEncryptedKVEnvs - should return raw values with no encryption', async () => {
      const team = 'test-key'
      const project = 'test-key'
      const stage = 'test-key'
      const user = { public_key: false }
      const ui = false

      const KV_STORE = {
        'test-key::test-key::test-key': {
          var1: 0,
          var2: 0,
        },
      }

      global.KV = {
        get: (key) => KV_STORE[key],
      }

      const { vars, encrypted } = await getEncryptedKVEnvs({
        team,
        project,
        stage,
        user,
        ui,
      })

      expect(vars.var1).toEqual(0)
      expect(vars.var2).toEqual(0)
      expect(encrypted).toEqual(false)
    })
  })
})
