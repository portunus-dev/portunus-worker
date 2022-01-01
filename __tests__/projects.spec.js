jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  getProject,
  createProject,
  listProjects,
  updateProjectName,
  deleteProject,
} = require('../modules/projects')

beforeEach(() => {
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Projects Module', () => {
  test('createProject successfully creates team, updates USERs stores and returns team id', async () => {
    const team = 'test'
    const project = 'test'

    const DETA = {}
    deta.putMock.mockImplementation((x) => (DETA[x.key] = x))
    await createProject({ team, project })
    const key = `${team}::${project}`
    const newProject = DETA[key]

    expect(deta.putMock).toBeCalledTimes(1)

    expect(newProject.key).toEqual(key)
    expect(newProject.team).toEqual(team)
    expect(newProject.project).toEqual(project)
  })
  test('getProjects returns value from DB', async () => {
    const team = 'test-key'
    const project = 'test-key'
    const dbProject = await getProject({ team, project })

    expect(dbProject.key).toEqual(`${team}::${project}`)
  })
  test('updateProjectName updates and returns key', async () => {
    const keyWithData = 'test-key::test-key'
    const newName = 'test1234'
    await updateProjectName({ name: newName, project: keyWithData })

    expect(deta.updateMock).toBeCalledTimes(1)
    expect(deta.TEST_DB.projects[keyWithData].project).toEqual(newName)
  })
  test('deleteProject should delete stages & project', async () => {
    const project = { key: 'test-key::test-key' }
    const stage = { key: 'test-key::test-key::test-key' }

    const KV_STORE = { 'test-key::test-key::test-key': true }
    global.KV = { delete: jest.fn((key) => delete KV_STORE[key]) }

    const DETA = {
      [project.key]: true,
    }
    deta.deleteMock
      .mockResolvedValueOnce(true)
      .mockImplementationOnce((project) => delete DETA[project])
    deta.fetchMock
      .mockResolvedValueOnce({ items: [stage] })
      .mockResolvedValueOnce({ items: [project] })

    const key = await deleteProject({ project: project.key })

    expect(deta.fetchMock).toBeCalledTimes(1)
    expect(deta.deleteMock).toBeCalledTimes(2)
    expect(KV_STORE[stage.key]).toBeUndefined()
    expect(key).toEqual(project.key)
    expect(DETA[project.key]).toBeUndefined()
  })
})
