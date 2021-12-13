const deta = require('./db')

// deta Base - users, for UI use
module.exports.get = (email) =>
  deta.Base('users').fetch({ email }, { limit: 1 })

module.exports.listTeamUsers = ({ team, limit, last }) =>
  deta
    .Base('users')
    .fetch([{ 'teams?contains': team }, { 'admins?contains': team }], {
      limit,
      last,
    })

module.exports.createUser = (email) => {
  const user = {
    email,
    teams: [],
    admins: [],
  }

  // TODO: do this "transactionally"
  const dbUser = await deta.Base('users').insert(user)
  await = USERS.put(user.email, JSON.stringify(user))

  return dbUser
}

module.exports.update = (user) => {
  if (!user.key) {
    throw new Error('user.key is required')
  }
  return Promise.all([
    // TODO: do this "transactionally"
    deta.Base('users').put(user), // deta.Base put(data)
    USERS.put(user.email, JSON.stringify(user)), // KV put(key, value)
  ])
}

module.exports.deleteUser = (user) => {
  if (!user.key) {
    throw new Error('user.key is required')
  }

  // TODO: what if they're the only user for a team? Should delete it!
  // TODO: what if they're the only admin for a team? Should make someone else admin!
  return Promise.all([
    // TODO: do this "transactionally"
    deta.Base('users').delete(user.key),
    USERS.delete(user.email),
  ])
}

// Cloudflare Workers KV - USERS, for CLI use
module.exports.getKVUser = (email) => USERS.get(email, { type: 'json' })
