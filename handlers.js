const jwt = require('jsonwebtoken')

const { KV, USERS, PROJECTS } = require('./db')

// process.env is not avail in workers
// const { TOKEN_SECRET, MAIL_PASS } = process.env

const extractParams = searchParams => (...params) =>
  params.reduce((acc, k) => {
    const v = searchParams.getAll(k)
    if (!v.length) {
      return acc
    }
    acc[k] = v.length === 1 ? v[0] : v
    return acc
  }, {})

const getUser = user => USERS.find(u => u.email === user && u.active) || {}

module.exports.root = ({ cf }) =>
  new Response(JSON.stringify({
    cli: 'pip install -U print-env --pre',
    'Web UI': 'wip',
    cf,
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })

// CLI handlers
module.exports.getToken = async ({ url }) => {
  const { searchParams } = new URL(url)
  const { user } = extractParams(searchParams)('user')
  // TODO: obviously rewire to DB (or Workers KV)
  const { email, jwt_uuid, team } = getUser(user)
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

const parseProj = (proj) => !isNaN(proj) && !isNaN(parseFloat(proj)) ? PROJECTS[proj] : proj

module.exports.getEnv = ({ url, headers }) => {
  const token = headers.get('portunus-jwt')
  if (!token) {
    return new Response(
      JSON.stringify({ message: 'Auth requires portunus-jwt' }),
      {
        headers: { 'content-type': 'application/json' },
        status: 403,
      }
    )
  }

  let access = {}
  try {
    access = jwt.verify(token, TOKEN_SECRET)
  } catch (error) {
    return new Response(JSON.stringify({ message: 'Invalid portunus-jwt' }), {
      headers: { 'content-type': 'application/json' },
      status: 403,
    })
  }
  const user = getUser(access.email)
  if (user.jwt_uuid !== access.jwt_uuid) {
    return new Response(JSON.stringify({ message: 'Invalid portunus-jwt' }), {
      headers: { 'content-type': 'application/json' },
      status: 403,
    })
  }
  // fallback team, if not requested
  const ft =
    user.team || (user.email.endsWith('@eqworks.com') ? 'EQ Works' : null)
  const { searchParams } = new URL(url)
  const { team = ft, project, project_id, stage = 'dev' } = extractParams(
    searchParams
  )('team', 'project', 'project_id', 'stage')
  if (!team) {
    return new Response(JSON.stringify({ message: 'Missing team' }), {
      headers: { 'content-type': 'application/json' },
      status: 400,
    })
  }
  const p = parseProj(project) || parseProj(project_id)
  if (!p) {
    return new Response(JSON.stringify({ message: 'Missing or invalid project' }), {
      headers: { 'content-type': 'application/json' },
      status: 400,
    })
  }
  // TODO: obviously rewire to DB (or Workers KV)
  const vars = KV[`${team}::${p}::${stage}`] || {}
  return new Response(
    JSON.stringify({ vars, encrypted: false, team, project: p, stage }), // TODO: encryption mechanism
    { headers: { 'content-type': 'application/json' } }
  )
}
