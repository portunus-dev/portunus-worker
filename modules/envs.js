const openpgp = require('openpgp')

const deta = require('./db')

module.exports.getStage = ({ team, project, stage = 'dev' }) =>
  deta.Base('stages').get(`${team}::${project}::${stage}`)

// deta.Base fetch({ project }, { limit, last })
// where `project` field is `team::project`
module.exports.listStages = async ({ team, project }) => {
  let stages = []
  try {
    ;({ items: stages } = await deta
      .Base('stages')
      .fetch({ project: `${team}::${project}` }, {}))
  } catch (e) {
    console.warn('Deta fetch error')
  }
  return { stages }
}

module.exports.createStage = ({ team, project, stage }) =>
  deta.Base('stages').put({
    team,
    project: `${team}::${project}`,
    stage,
    key: `${team}::${project}::${stage}`,
    updated: new Date(),
    vars: 0,
  })

module.exports.deleteStage = (stage) =>
  Promise.all([deta.Base('stages').delete(stage), KV.delete(stage)])

module.exports.updateStageVars = async ({ stage, updates }) => {
  const updated = new Date()
  const key = stage
  // updates = vars update actions
  // can be add, remove, or edit
  // { add: { key: value, ... }, remove: [key], edit: { key: value, ... } }

  // TODO: need to validate whether there are colliding keys in the updates
  //    -> results will just be based on order of actions
  let vars = 0 // compute deta.Base('stages).utils.increment value for `vars` field
  let kvVars = await KV.get(key, { type: 'json' }) // update vars with each action
  let changes = 0
  Object.entries(updates).forEach(([action, items]) => {
    changes += Object.keys(items).length
    if (action === 'add') {
      vars += Object.keys(items).length
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

  const actions = []

  if (vars !== 0) {
    const stages = deta.Base('stages')
    actions.push(
      stages.update({ vars: stages.util.increment(vars), updated }, key)
    )
  }
  actions.push(KV.put(key, JSON.stringify(kvVars), { metadata: { updated } }))
  await Promise.all(actions)

  return changes
}

// Cloudflare KV - KV, for CLI use
const getKVEnvs = ({ team, p, stage }) =>
  KV.get(`${team}::${p}::${stage}`, { type: 'json' })

module.exports.getKVEnvs = getKVEnvs

module.exports.getEncryptedKVEnvs = async ({
  team,
  project,
  stage,
  user,
  ui,
}) => {
  // default to CLI use with no encryption
  let vars = (await getKVEnvs({ team, p: project, stage })) || {}
  let encrypted = false

  if (ui) {
    // trim values for UI
    vars = Object.keys(vars).reduce((agg, k) => ({ ...agg, [k]: '' }), {})
  } else if (user.public_key) {
    encrypted = true

    const publicKey = await openpgp.readKey({
      armoredKey: user.public_key,
    })

    // if we want to sign ourselves for verification?

    // const privateKey = await openpgp.decryptKey({
    //     privateKey: await openpgp.readPrivateKey({ armoredKey: privateKeyArmored }),
    //     passphrase
    // });

    const enc = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: JSON.stringify(vars) }), // input as Message object
      encryptionKeys: publicKey,
      // signingKeys: privateKey // optional
    })

    vars = enc
  }

  return { vars, encrypted }
}
