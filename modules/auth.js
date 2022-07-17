const jose = require('jose')

const { HTTPError, respondError } = require('./utils')
const { getKVUser } = require('./users')

// process.env is not avail in workers, direct access like KV namespaces and secrets

const verifyJWT = (headers) => {
  const token = headers.get('portunus-jwt')
  if (!token) {
    throw new HTTPError('Auth requires portunus-jwt', 403)
  }
  let access = {}
  try {
    const { payload } = jose.jwtVerify(token, TOKEN_SECRET)
    access = payload
  } catch (_) {
    throw new HTTPError('Invalid portunus-jwt', 403)
  }
  if (!access.email) {
    throw new HTTPError('Invalid portunus-jwt: no email', 403)
  }
  return access
}

const verifyUser = async (access) => {
  const user = await getKVUser(access.email)
  if (user.jwt_uuid !== access.jwt_uuid) {
    throw new HTTPError('Invalid portunus-jwt: UUID mismatch', 403)
  }

  return user
}

module.exports.withRequireUser = async (req) => {
  const { headers } = req
  try {
    const access = verifyJWT(headers)
    req.user = await verifyUser(access)
  } catch (err) {
    return respondError(err)
  }
}
