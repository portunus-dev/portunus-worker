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

module.exports.updateProjectName = ({ project, name }) => {
  deta.Base('projects').update(
    {
      name,
    },
    project
  )
}

module.exports.deleteProject = async ({ project }) => {
  // delete stages and KV
  let stages = []
  try {
    ;({ items: stages } = await deta.Base('stages').fetch({ project }))
  } catch (e) {}

  await Promise.all(
    stages.map(
      async ({ key }) =>
        await Promise.all([deta.Base('stages').delete(key), KV.delete(key)])
    )
  )

  await deta.Base('projects').delete(project)

  return project
}
