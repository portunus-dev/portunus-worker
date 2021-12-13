const deta = require('./db')

// deta Base - teams, projects, and stages, for UI use
module.exports.getProject = ({ team, project }) =>
  deta.Base('projects').get(`${team}::${project}`)
module.exports.getStage = ({ team, project, stage = 'dev' }) =>
  deta.Base('stages').get(`${team}::${project}::${stage}`)
// deta.Base fetch({ team }, { limit, last })
module.exports.listProjects = deta.Base('projects').fetch
// deta.Base fetch({ project }, { limit, last })
// where `project` field is `team::project`
module.exports.listStages = deta.Base('stages').fetch

module.exports.createProject = ({ team, project }) =>
  deta.Base('projects').put({
    team,
    project,
    key: `${team}::${project}`,
    updated: new Date(),
  })
module.exports.updateProject = deta.Base('projects').put // stub for now

module.exports.createStage = ({ team, project, stage }) =>
  deta.Base('stages').put({
    team,
    project: `${team}::${project}`,
    stage,
    key: `${team}::${project}::${stage}`,
    updated: new Date(),
  })

module.exports.createStageVars = ({ team, project, stage, vars }) => {
  const updated = new Date()
  const key = `${team}::${project}::${stage}`
  // TODO: make this "transactional"
  return Promise.all([
    deta.Base('stages').put({
      project: `${team}::${project}`,
      stage,
      key,
      vars: vars.length, // deta Base only stores the count
      updated,
    }),
    // Cloudflare KV stores actual env vars of the stage
    KV.put(key, JSON.stringify(vars), { metadata: { updated } }),
  ])
}
module.exports.updateStageVars = async ({ team, project, stage, updates }) => {
  const updated = new Date()
  const key = `${team}::${project}::${stage}`
  // updates = vars update actions
  // can be add, remove, or edit
  // { add: { key: value, ... }, remove: [key], edit: { key: value, ... } }
  // TODO: need to validate whether there are colliding keys in the updates
  // compute deta.Base('stages).utils.increment value for `vars` field
  const actions = []
  let vars = 0
  // update Cloudflare KV with updates
  let kvVars = await KV.get(key, { type: 'json' })
  Object.entries(updates).forEach(([action, items]) => {
    if (action === 'add') {
      vars += items.length
      kvVars = { ...kvVars, ...items }
    } else if (action === 'remove') {
      vars -= items.length
      items.forEach((key) => {
        delete kvVars[key]
      })
    } else if (action === 'edit') {
      kvVars = { ...kvVars, ...items }
    }
  })
  if (vars !== 0) {
    const stages = deta.Base('stages')
    actions.push(
      stages.update({ vars: stages.util.increment(vars), updated }, key)
    )
  }
  actions.push(KV.put(key, JSON.stringify(kvVars), { metadata: { updated } }))
  return Promise.all(actions)
}

// Cloudflare KV - KV, for CLI use
module.exports.getKVEnvs = ({ team, p, stage }) =>
  KV.get(`${team}::${p}::${stage}`, { type: 'json' })
