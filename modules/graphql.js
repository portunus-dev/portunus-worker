// FaunaDB query interface
module.exports = ({ index, query, variables }) =>
  fetch('https://graphql.fauna.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${FAUNA_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
    .then((r) => r.json())
    .then(({ data }) => (data || {})[index] || {})
