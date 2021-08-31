const jwt = require('jsonwebtoken')

const { extractParams, parseProj, HTTPError } = require('./utils')
const { getKVUser } = require('./users')

// process.env is not avail in workers, direct access like KV namespaces and secrets

module.exports.verifyJWT = (headers) => {
  const token = headers.get('portunus-jwt')
  if (!token) {
    throw new HTTPError('Auth requires portunus-jwt', 403)
  }
  let access = {}
  try {
    access = jwt.verify(token, TOKEN_SECRET)
  } catch (_) {
    throw new HTTPError('Invalid portunus-jwt', 403)
  }
  if (!access.email) {
    throw new HTTPError('Invalid portunus-jwt: no email', 403)
  }
  return access
}

module.exports.verifyUser = async (access) => {
  const user = await getKVUser(access.email)
  if (user.jwt_uuid !== access.jwt_uuid) {
    throw new HTTPError('Invalid portunus-jwt: UUID mismatch', 403)
  }
  if (access.team && !user.teams.includes(access.team)) {
    throw new HTTPError('Invalid portunus-jwt: team mismatch', 403)
  }
  return user
}

module.exports.parseJWT = async ({ url, headers }) => {
  const access = this.verifyJWT(headers)
  const user = await this.verifyUser(access)
  const { searchParams } = new URL(url)
  const {
    team = user.teams[0],
    project,
    project_id,
    stage = 'dev',
  } = extractParams(searchParams)('team', 'project', 'project_id', 'stage')
  if (team && !user.teams.includes(team)) {
    throw new HTTPError('Invalid portnus-jwt: no team access', 403)
  }
  const p = parseProj(project) || parseProj(project_id)
  if (!p) {
    throw new HTTPError('Invalid portunus-jwt: no project access', 400)
  }
  return { user, team, p, stage }
}
