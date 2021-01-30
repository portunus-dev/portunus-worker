const jwt = require('jsonwebtoken')

const { extractParams, parseProj, isSecret } = require('./modules/utils')
const { getUser } = require('./modules/users')

// process.env is not avail in workers, direct access like KV namespaces and secrets

class HTTPError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

const respondError = (err) =>
  new Response(JSON.stringify({ message: err.message }), {
    headers: { 'content-type': 'application/json' },
    status: err.status || 500,
  })

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
  const user = await getUser(access.email)
  if (user.jwt_uuid !== access.jwt_uuid) {
    throw new HTTPError('Invalid portunus-jwt', 403)
  }
  // fallback team, if not requested
  const ft =
    user.team || (user.email.endsWith('@eqworks.com') ? 'EQ Works' : null)
  const { searchParams } = new URL(url)
  const { team = ft, project, project_id, stage = 'dev' } = extractParams(
    searchParams
  )('team', 'project', 'project_id', 'stage')
  if (!team) {
    throw new HTTPError('Missing team from portunus-jwt', 400)
  }
  const p = parseProj(project) || parseProj(project_id)
  if (!p) {
    throw new HTTPError('Invalid project from portunus-jwt', 400)
  }
  return { team, p, stage }
}

module.exports.root = ({ cf }) =>
  new Response(
    JSON.stringify({
      cli: 'pip install -U print-env --pre',
      'Web UI': 'wip',
      cf,
    }),
    {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }
  )

const maskValue = (_v) => {
  if (!_v) {
    return _v
  }
  const v = String(_v)
  const m = v.replace(/./g, '*') // masked
  const c = Math.min(4, Math.floor(v.length / 4)) // cutoff
  const f = Math.min(v.length - c, 10) // filler
  return v.substring(0, c) + m.substring(0, f) + v.substring(v.length - c)
}

const maskURL = (_u) => {
  const u = new URL(_u)
  const p = u.protocol
  u.protocol = 'https'
  u.username = '**REDACTED_USER**'
  u.password = '**REDACTED_PASS**'
  u.hostname = u.hostname
    .split('.')
    .map((v, i, a) => {
      const c = Math.floor(v.length / 2)
      if (i < a.length - 2) {
        return v.substring(0, c) + (c > 0 ? '__redacted' : '')
      }
      return v
    })
    .join('.')
  u.pathname = '__redacted'
  u.protocol = p
  return u
}

const hideValues = ({ value, metadata: { secrets = [] } }) => {
  return Object.entries(value).map(([k, v]) => {
    const isSec = isSecret(k) || secrets.includes(k)
    try {
      const url = maskURL(v)
      return url.href
    } catch (_) {
      // fallthrough
    }
    if (isSec) {
      return maskValue(v)
    }
  })
}

module.exports.getUIEnv = async ({ url, headers }) => {
  // get envs without values (or partially hide) by default
  // retrieve metadata on top of values (compare to getEnv for CLI)
  try {
    const { team, p, stage } = await parseJWT({ url, headers })
    const { value, metadata } = await KV.getWithMetadata(
      `${team}::${p}::${stage}`,
      'json'
    )
    return new Response(
      JSON.stringify({
        vars: hideValues(value),
        metadata,
        encrypted: false,
        team,
        project: p,
        stage,
      }), // TODO: encryption mechanism
      { headers: { 'content-type': 'application/json' } }
    )
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
  const { user } = extractParams(searchParams)('user')
  const { email, jwt_uuid, team } = await getUser(user)
  if (!jwt_uuid) {
    return new Response(JSON.stringify({ message: `${user} not found` }), {
      headers: { 'content-type': 'application/json' },
      status: 404,
    })
  }
  const token = jwt.sign({ email, jwt_uuid, team }, TOKEN_SECRET)

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
    return new Response(
      JSON.stringify({ message: `Unable to send token to ${user}` }),
      {
        headers: { 'content-type': 'application/json' },
        status: 500,
      }
    )
  }
  return new Response(JSON.stringify({ message: `Token sent to ${user}` }), {
    headers: { 'content-type': 'application/json' },
  })
}
module.exports.getEnv = async ({ url, headers }) => {
  try {
    const { team, p, stage } = await parseJWT({ url, headers })
    const vars = await KV.get(`${team}::${p}::${stage}`, 'json')
    return new Response(
      JSON.stringify({ vars, encrypted: false, team, project: p, stage }), // TODO: encryption mechanism
      { headers: { 'content-type': 'application/json' } }
    )
  } catch (err) {
    return respondError(err)
  }
}
