module.exports.corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'portunus-jwt,Content-Type',
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
