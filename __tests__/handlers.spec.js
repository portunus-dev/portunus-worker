jest.mock('../modules/db')
const deta = require('../modules/db')

jest.mock('../modules/teams')
const teamModule = require('../modules/teams')

const ResponseTest = require('../ResponseTest')

const {
  listAll,
  listTeams,
  createTeam,
  updateTeamName,
  deleteTeam,
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
