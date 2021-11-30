const deta = require('./db')

// deta Base - teams, projects, and stages, for UI use
module.exports.getTeam = deta.Base('teams').get
module.exports.getProject = ({ team, project }) =>
  deta.Base('projects').get(`${team}::${project}`)
module.exports.getStage = ({ team, project, stage = 'dev' }) =>
  deta.Base('stages').get(`${team}::${project}::${stage}`)
// deta.Base fetch({ team }, { limit, last })
module.exports.listProjects = deta.Base('projects').fetch
// deta.Base fetch({ project }, { limit, last })
// where `project` field is `team::project`
module.exports.listStages = deta.Base('stages').fetch

module.exports.createTeam = async ({ name, user }) => {
  // create team metadata in deta Base
  const { key: team } = await deta.Base('teams').put({ name })
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')
  return Promise.all([
    users.update({ teams: users.utils.append(team) }, user.key),
    USERS.put(user.email, { ...user, teams: [...user.teams, team] }),
  ])
}

// Cloudflare KV - KV, for CLI use
module.exports.getKVEnvs = ({ team, p, stage }) =>
  KV.get(`${team}::${p}::${stage}`, { type: 'json' })
