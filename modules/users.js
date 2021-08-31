const deta = require('./db')

// deta Base - users
// TODO: put/update
module.exports.get = (email) =>
  deta.Base('users').fetch({ email }, { limit: 1 })

// Cloudflare Workers KV - USERS
module.exports.getKVUser = (email) => USERS.get(email, { type: 'json' })
