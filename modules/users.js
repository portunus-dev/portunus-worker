const deta = require('./db')

// deta Base - users, for UI use
module.exports.get = (email) =>
  deta.Base('users').fetch({ email }, { limit: 1 })

module.exports.update = (user) => {
  if (!user.key) {
    throw new Error('user.key is required')
  }
  return Promise.all([
    // TODO: do this "transactionally"
    deta.Base('users').put(user), // deta.Base put(data)
    USERS.put(user.email, user), // KV put(key, value)
  ])
}

// Cloudflare KV - USERS, for CLI use
module.exports.getKVUser = (email) => USERS.get(email, { type: 'json' })
