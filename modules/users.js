// legacy KV based USERS
module.exports.getUser = (email) =>
  USERS.get(email, 'json').then((u) => {
    if (!u.active) {
      return {}
    }
    return u
  })

module.exports.getUserByEmail = (email) => {
  const index = 'findUserByEmail' // GraphQL connected FaunaDB index
  const query = `
    query ($email: String!) {
      ${index}(email: $email) {
        _id
        _ts
        email
        name
        jwt_uuid
        team {
          _id
          name
        }
        admin
        active
      }
    }
  `
  const variables = { email }
  return fetch('https://graphql.fauna.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${FAUNA_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  }).then(r => r.json()).then(({ data }) => (data || {})[index] || {})
}
