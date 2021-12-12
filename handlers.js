const jwt = require('jsonwebtoken')

const {
  extractParams,
  HTTPError,
  respondError,
  respondJSON,
} = require('./modules/utils')
const { getKVUser } = require('./modules/users')
const { createTeam, createProject, getKVEnvs } = require('./modules/envs')
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
module.exports.listAll = async ({ headers }) => {
  try {
    const access = verifyJWT(headers)
    const user = await verifyUser(access)

    const teams = await Promise.all(
      user.teams.map((key) => deta.Base('teams').get(key))
    )
    const teamProjects = await Promise.all(
      teams.map((t) => deta.Base('projects').fetch({ team: t.key }, {}).then(({ items }) => items ))
    )

    const projects = teamProjects.flat()

    const projectStages = await Promise.all(
      projects.map((p) => deta.Base('stages').fetch({ project: p.key }, {}).then(({ items }) => items ))
    )

    const stages = projectStages.flat()

    const payload = { teams, projects, stages }

    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listTeams = async ({ headers }) => {
  try {
    const access = verifyJWT(headers)
    const user = await verifyUser(access)

    const teams = await Promise.all(
      user.teams.map(
        (key) =>
          new Promise(async (resolve) => {
            const payload = await deta.Base('teams').get(key)
            resolve({ ...payload, admin: false })
          })
      )
    )
    const admins = await Promise.all(
      user.admins.map(
        (key) =>
          new Promise(async (resolve) => {
            const payload = await deta.Base('teams').get(key)
            resolve({ ...payload, admin: true })
          })
      )
    )
    return respondJSON({
      payload: [...teams, ...admins],
    })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createTeam = async ({ headers, content }) => {
  try {
    if (!content.name || content.name.length < 3) {
      throw new HTTPError(
        'Invalid team name: name must be at least 3 characters',
        400
      )
    }
    const access = verifyJWT(headers)
    const user = await verifyUser(access)
    const key = await createTeam({ user, name: content.name })
    return respondJSON({ payload: { key } })
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

module.exports.createProject = async ({ content, headers }) => {
  try {
    const { team, name } = content
    if (!name || name.length < 3) {
      throw new HTTPError(
        'Invalid project name: name must be at least 3 characters',
        400
      )
    }
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    const access = verifyJWT(headers)
    const user = await verifyUser(access)

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const payload = await createProject({ team, project: name })

    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listStages = async ({ query, headers }) => {
  try {
    const { team, project, limit, last } = query
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400)
    }

    const access = verifyJWT(headers)
    const user = await verifyUser(access)

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const payload = await deta
      .Base('stages')
      .fetch({ team, project }, { limit, last })
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createStage = async ({ content, headers }) => {
  try {
    const { team, project, name } = content
    if (!name || name.length < 3) {
      throw new HTTPError(
        'Invalid stage name: name must be at least 3 characters',
        400
      )
    }
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400)
    }

    const access = verifyJWT(headers)
    const user = await verifyUser(access)

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const payload = await createStage({ team, project, stage: name })

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

module.exports.getUser = async ({ headers }) => {
  try {
    const access = verifyJWT(headers)
    const payload = await verifyUser(access)
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

// also shared for UI
module.exports.getEnv = async ({ url, headers }) => {
  try {
    const parsed = await parseJWT({ url, headers })
    const vars = (await getKVEnvs(parsed)) || {}
    return respondJSON({
      payload: {
        vars,
        encrypted: false,
        ...parsed,
        project: parsed.p, // TODO: perhaps stick with `p` for frontend read use-cases
      },
    })
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
  } = (await getKVUser(user)) || {}

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
