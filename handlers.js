const jwt = require('jsonwebtoken')

const {
  extractParams,
  parseProj,
  hideValues,
  HTTPError,
  respondError,
  respondJSON,
} = require('./modules/utils')
const { getFaunaUser } = require('./modules/users')

// process.env is not avail in workers, direct access like KV namespaces and secrets

const parseJWT = async ({ url, headers }) => {
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
  const user = await getFaunaUser(access.email)
  if (user.jwt_uuid !== access.jwt_uuid) {
    throw new HTTPError('Invalid portunus-jwt: UUID mismatch', 403)
  }
  // fallback team, if not requested
  const teams = user.teams.map(({ ref }) => ref.value.id)
  const ft = user.team || teams[0] || (user.email.endsWith('@eqworks.com') ? '290204995910894083' : null)
  const { searchParams } = new URL(url)
  const { team = ft, project, project_id, stage = 'dev' } = extractParams(
    searchParams
  )('team', 'project', 'project_id', 'stage')
  if (!teams.includes(team)) {
    throw new HTTPError('Invalid portnus-jwt: no team access', 403)
  }
  const p = parseProj(project) || parseProj(project_id)
  if (!p) {
    throw new HTTPError('Invalid portunus-jwt: no project access', 400)
  }
  return { team, p, stage }
}

module.exports.root = ({ cf }) => respondJSON({
  payload: {
    cli: 'pip install -U print-env --pre',
    'Web UI': 'wip',
    cf,
  },
})

module.exports.getUIEnv = async ({ url, headers }) => {
  // get envs without values (or partially hide) by default
  // retrieve metadata on top of values (compare to getEnv for CLI)
  try {
    const { team, p, stage } = await parseJWT({ url, headers })
    const { value, metadata } = await KV.getWithMetadata(
      `${team}::${p}::${stage}`,
      'json'
    )
    return respondJSON({
      payload: {
        vars: hideValues({ value, metadata }),
        metadata,
        encrypted: false,
        team,
        project: p,
        stage,
      },
    })
  } catch (err) {
    return respondError(err)
  }
}

// module.exports.listUIEnvs = async({ url, headers }) => {
//   // list envs by user and team
// }

// module.exports.listUIUsers = async({ url, headers }) => {
//   // list users of the same org
//   // need to add
// }

// CLI handlers
module.exports.getToken = async ({ url }) => {
  const { searchParams } = new URL(url)
  // TODO: need to mimic getEnv to support multiple-team user
  const { user, team } = extractParams(searchParams)('user')
  const { email, jwt_uuid, teams } = await getFaunaUser(user)
  const _teams = teams.map(({ ref }) => ref.value.id)
  const _team = team || _teams[0]

  if (!jwt_uuid) {
    return respondError(new HTTPError(`${user} not found`, 404))
  }

  if (!_teams.includes(_team)) {
    return respondError(new HTTPError('Invalid portnus-jwt: no team access', 403))
  }

  const token = jwt.sign({ email, jwt_uuid, team: _team }, TOKEN_SECRET)

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
module.exports.getEnv = async ({ url, headers }) => {
  try {
    const { team, p, stage } = await parseJWT({ url, headers })
    const vars = await KV.get(`${team}::${p}::${stage}`, 'json') || {}
    return respondJSON({ vars, encrypted: false, team, project: p, stage })
  } catch (err) {
    return respondError(err)
  }
}
