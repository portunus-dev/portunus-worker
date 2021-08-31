const { PROJECTS } = require('./compat')

module.exports.extractParams =
  (searchParams) =>
  (...params) =>
    params.reduce((acc, k) => {
      const v = searchParams.getAll(k)
      if (!v.length) {
        return acc
      }
      acc[k] = v.length === 1 ? v[0] : v
      return acc
    }, {})

module.exports.parseProj = (proj) =>
  !isNaN(proj) && !isNaN(parseFloat(proj)) ? PROJECTS[proj] : proj

module.exports.corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'portunus-jwt',
  'Access-Control-Max-Age': '86400',
}

module.exports.HTTPError = class extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

module.exports.respondError = (err) =>
  new Response(JSON.stringify({ message: err.message, stack: err.stack }), {
    headers: { ...this.corsHeaders, 'content-type': 'application/json' },
    status: err.status || 500,
  })

module.exports.respondJSON = ({ payload, status = 200, headers = {} }) =>
  new Response(JSON.stringify(payload), {
    headers: {
      ...this.corsHeaders,
      ...headers,
      'content-type': 'application/json',
    },
    status,
  })
