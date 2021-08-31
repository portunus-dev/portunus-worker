const jwt = require('jsonwebtoken')

const {
  extractParams,
  HTTPError,
  respondError,
  respondJSON,
} = require('./modules/utils')
const { getKVUser } = require('./modules/users')
const { verifyJWT, verifyUser, parseJWT } = require('./modules/auth')
const deta = require('./modules/db')

// process.env is not avail in workers, direct access like KV namespaces and secrets

module.exports.root = ({ cf }) =>
  respondJSON({
    payload: {
      cli: 'pip install -U print-env --pre',
      'Web UI': 'wip',
      cf,
    },
  })

// UI handlers
module.exports.getUser = async ({ headers }) => {
  try {
    const access = verifyJWT(headers)
    const payload = await verifyUser(access)
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}
module.exports.listUsers = async ({ url, headers }) => {
  try {
    const access = verifyJWT(headers)
    const user = await verifyUser(access)
    // verify user team access
    const { searchParams } = new URL(url)
    const {
      team = user.teams[0],
      limit,
      last,
    } = extractParams(searchParams)('team', 'limit', 'last')
    if (team && !user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const payload = await deta
      .Base('users')
      .fetch([{ 'teams?contains': team }, { 'admins?contains': team }], {
        limit,
        last,
      })
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}
module.exports.listProjects = async ({ url, headers }) => {
  try {
    const access = verifyJWT(headers)
    const user = await verifyUser(access)
    // verify user team access
    const { searchParams } = new URL(url)
    const {
      team = user.teams[0],
      limit,
      last,
    } = extractParams(searchParams)('team')
    if (team && !user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const payload = await deta.Base('projects').fetch({ team }, { limit, last })
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
  const {
    email,
    jwt_uuid,
    teams: [defaultTeam],
  } = await getKVUser(user)

  if (!jwt_uuid) {
    return respondError(new HTTPError(`${user} not found`, 404))
  }

  const token = jwt.sign(
    { email, jwt_uuid, team: team || defaultTeam },
    TOKEN_SECRET
  )

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
    const vars = (await KV.get(`${team}::${p}::${stage}`, { type: 'json' })) || {}
    return respondJSON({
      payload: { vars, encrypted: false, team, project: p, stage },
    })
  } catch (err) {
    return respondError(err)
  }
}
