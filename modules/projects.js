const deta = require('./db')

module.exports.getProject = ({ team, project }) =>
  deta.Base('projects').get(`${team}::${project}`)

module.exports.listProjects = ({ team, limit, last }) =>
  deta.Base('projects').fetch({ team }, { limit, last })

module.exports.createProject = ({ team, project }) =>
  deta.Base('projects').put({
    team,
    project,
    key: `${team}::${project}`,
    updated: new Date(),
  })

module.exports.updateProject = deta.Base('projects').put // stub for now
