import jwt from '@tsndr/cloudflare-worker-jwt'

const { HTTPError, respondError } = require('./utils')
const { getKVUser } = require('./users')

const verifyJWT = async (headers) => {
  const token = headers.get('portunus-jwt')
  if (!token) {
    console.error('Error: No portunus-jwt found in headers.')
    throw new HTTPError('Auth requires portunus-jwt', 403)
  }
  let access = {}
  try {
    await jwt.verify(token, TOKEN_SECRET)

    // Decoding token
    const { payload } = jwt.decode(token)
    access = payload
  } catch (error) {
    console.error('Error: Invalid portunus-jwt.', error)
    throw new HTTPError('Invalid portunus-jwt', 403)
  }
  if (!access.email) {
    console.error('Error: No email in portunus-jwt.')
    throw new HTTPError('Invalid portunus-jwt: no email', 403)
  }
  return access
}

const verifyUser = async (access) => {
  const user = await getKVUser(access.email)
  if (!user) {
    console.error('Error: No user found with this email.')
    throw new HTTPError('No user found with this email', 404)
  }
  if (user.jwt_uuid !== access.jwt_uuid) {
    console.error('Error: UUID mismatch in portunus-jwt.')
    throw new HTTPError('Invalid portunus-jwt: UUID mismatch', 403)
  }

  return user
}

module.exports.withRequireUser = async (req) => {
  const { headers } = req
  try {
    const access = await verifyJWT(headers)
    req.user = await verifyUser(access)
  } catch (err) {
    console.error('Error: Failed to verify user.', err)
    return respondError(req)
  }
}
