module.exports.minimalLog = ({ method, url, query, body }) => ({
  method,
  url,
  query,
  body,
})

module.exports.withLogging = (req) => {
  if (req._log) {
    // "singleton"
    return
  }
  const { cf, headers: _headers } = req
  // build headers object
  const headers = {}
  for (const [key, value] of _headers) {
    headers[key] = value
  }
  req._log = { ...this.minimalLog(req), headers, cf, start: Date.now() }
}
