const faunadb = require('faunadb')
const { query: q } = faunadb

// legacy KV based USERS
module.exports.getUser = (email) =>
  USERS.get(email, 'json').then((u) => {
    if (!u.active) {
      return {}
    }
    return u
  })

module.exports.getFaunaUser = (email) => {
  // https://github.com/fauna/faunadb-js#using-with-cloudflare-workers
  const client = new faunadb.Client({
    secret: FAUNA_KEY,
    fetch: (url, params) => {
      const signal = params.signal
      delete params.signal
      const abortPromise = new Promise(resolve => {
        if (signal) {
          signal.onabort = resolve
        }
      })
      return Promise.race([abortPromise, fetch(url, params)])
    },
  })
  const query = q.Get(q.Match(q.Index('users_by_unique_email'), email))
  return client.query(query).then(({ data }) => {
    if (!data.active) {
      return {}
    }
    return data
  })
}
