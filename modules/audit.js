module.exports.withLogging = (req) => {
  // in-case _log is already set or client requests with no logging
  const { headers: _headers } = req
  if (req._log || _headers.get('portunus-no-log')) {
    return
  }
  const { method, url, cf, query, body } = req
  // build headers object
  const headers = {}
  for (const [key, value] of _headers) {
    headers[key] = value
  }
  req._log = { method, url, cf, headers, query, body }
}
