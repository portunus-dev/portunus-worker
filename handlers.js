const jwt = require('jsonwebtoken')

const {
  extractParams,
  parseProj,
  HTTPError,
  respondError,
  respondJSON,
} = require('./modules/utils')
const { getUserByEmail } = require('./modules/users')

// process.env is not avail in workers, direct access like KV namespaces and secrets

module.exports.root = ({ cf }) => respondJSON({
  payload: {
    cli: 'pip install -U print-env --pre',
    'Web UI': 'wip',
    cf,
  },
})

const verifyJWT = (headers) => {
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
    throw new HTTPError('Invalid portunus-jwt', 403)
  }
  return access
}

const verifyUser = async (access) => {
  const user = await getUserByEmail(access.email)
  if (!user.active) {
    throw new HTTPError('Invalid portunus-jwt: inactive user', 403)
  }
  if (user.jwt_uuid !== access.jwt_uuid) {
    throw new HTTPError('Invalid portunus-jwt: UUID mismatch', 403)
  }
  if (access.team && access.team !== user.team._id) {
    throw new HTTPError('Invalid portunus-jwt: team mismatch', 403)
  }
  return user
}

const parseJWT = async ({ url, headers }) => {
  const access = verifyJWT(headers)
  const user = await verifyUser(access)
  const { searchParams } = new URL(url)
  const { team = user.team._id, project, project_id, stage = 'dev' } = extractParams(
    searchParams
  )('team', 'project', 'project_id', 'stage')
  if (team && team !== user.team._id) {
    throw new HTTPError('Invalid portnus-jwt: no team access', 403)
  }
  const p = parseProj(project) || parseProj(project_id)
  if (!p) {
    throw new HTTPError('Invalid portunus-jwt: no project access', 400)
  }
  return { user, team, p, stage }
}

module.exports.getUser = async ({ headers }) => {
  try {
    const access = verifyJWT(headers)
    const payload = await verifyUser(access)
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

// CLI handlers
module.exports.getToken = async ({ url }) => {
  const { searchParams } = new URL(url)
  // TODO: need to mimic getEnv to support multiple-team user
  const { user, team } = extractParams(searchParams)('user')
  const { email, jwt_uuid, team: { _id: teamID } } = await getUserByEmail(user)

  if (!jwt_uuid) {
    return respondError(new HTTPError(`${user} not found`, 404))
  }

  const token = jwt.sign({ email, jwt_uuid, team: team || teamID }, TOKEN_SECRET)

  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${MAIL_PASS}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'dev@mindswire.com' },
        subject: 'print-env token',
        content: [{ type: 'text/plain', value: token }],
      }),
    })
  } catch (error) {
    return respondError(new HTTPError(`Unable to send token to ${user}`, 500))
  }

  return respondJSON({ payload: { message: `Token sent to ${user}` } })
}

// also shared for UI
module.exports.getEnv = async ({ url, headers }) => {
  try {
    const { team, p, stage } = await parseJWT({ url, headers })
    const vars = await KV.get(`${team}::${p}::${stage}`, 'json') || {}
    return respondJSON({ payload: { vars, encrypted: false, team, project: p, stage } })
  } catch (err) {
    return respondError(err)
  }
}
