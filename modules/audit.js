module.exports.withLogging = (req) => {
  const { method, url, cf, headers, query, body } = req
  // TODO: how to log out all headers?
  req._log = { method, url, cf, headers, query, body }
}
