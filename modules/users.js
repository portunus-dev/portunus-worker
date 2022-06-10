const { v4: uuidv4 } = require('uuid')

const deta = require('./db')

// deta Base - users, for UI use
// TODO: deprecated in favor of getUser below
module.exports.fetchUser = (email) =>
  deta
    .Base('users')
    .fetch({ email }, { limit: 1 })
    .then(({ items = [] }) => items[0] || null)

module.exports.getUser = deta.Base('users').get

module.exports.listTeamUsers = ({ team }) =>
  deta
    .Base('users')
    .fetch([{ 'teams?contains': team }, { 'admins?contains': team }], {})

module.exports.createUser = async (email, { getKVUser = false } = {}) => {
  const user = {
    email,
    jwt_uuid: uuidv4(),
    otp_secret: uuidv4(),
    teams: [],
    admins: [],
    updated: new Date(),
    audit: false,
  }
  if (user.jwt_uuid === user.otp_secret) {
    // Note: this shouldn't really happen anyway
    throw new Error('jwt_uuid and otp_secret must be different')
  }
  // TODO: do this "transactionally"
  const dbUser = await deta.Base('users').insert(user, email) // email as key
  // remove deta exclusive fields (such as otp_secret)
  const kvUser = { ...dbUser }
  delete kvUser.otp_secret
  await USERS.put(user.email, JSON.stringify(kvUser))

  return getKVUser ? kvUser : dbUser
}

module.exports.updateUser = (user) => {
  if (!user.key) {
    throw new Error('user.key is required')
  }
  // remove deta exclusive fields (such as otp_secret)
  const kvUser = { ...user }
  delete kvUser.otp_secret
  return Promise.all([
    // TODO: do this "transactionally"
    deta.Base('users').put(user), // deta.Base put(data)
    USERS.put(user.email, JSON.stringify(kvUser)), // KV put(key, value)
  ])
}

// TODO: this should not allow duplicate teams
module.exports.addUserToTeam = ({ user, team }) => {
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')
  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  return Promise.all([
    users.update({ teams: users.util.append(team) }, user.key),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        teams: [...user.teams, team],
      })
    ),
  ])
}

module.exports.removeUserFromTeam = ({ user, team }) => {
  // update user in both deta Base and Cloudflare KV
  const teams = user.teams.filter((o) => o !== team)
  const admins = user.admins.filter((o) => o !== team)
  const users = deta.Base('users')

  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  return Promise.all([
    users.update({ teams, admins }, user.key),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        teams,
        admins,
      })
    ),
  ])
}

// TODO: this should not allow duplicate teams
// TODO: should it also add to .teams?
module.exports.addUserToAdmin = ({ user, team }) => {
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')
  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  return Promise.all([
    users.update({ admins: users.util.append(team) }, user.key),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        admins: [...user.admins, team],
      })
    ),
  ])
}

module.exports.removeUserFromAdmin = ({ user, team }) => {
  // update user in both deta Base and Cloudflare KV

  const admins = user.admins.filter((o) => o !== team)
  const users = deta.Base('users')

  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  return Promise.all([
    users.update({ admins }, user.key),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        admins,
      })
    ),
  ])
}

module.exports.deleteUser = (user) => {
  if (!user.key) {
    throw new Error('user.key is required')
  }
  if (!user.email) {
    throw new Error('user.email is required')
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
