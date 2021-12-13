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
  await = USERS.put(user.email, JSON.stringify(dbUser))

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

module.exports.addUserToTeam = ({ user, team }) => {
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')
  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  return await Promise.all([
    users.update(
      { teams: users.util.append(team), admins: users.util.append(team) },
      user.key
    ),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        teams: [...user.teams, team],
        admins: [...user.admins, team],
      })
    ),
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
