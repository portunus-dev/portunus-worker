const jwt = require('jsonwebtoken')

const {
  extractParams,
  HTTPError,
  respondError,
  respondJSON,
} = require('./modules/utils')
const { getKVUser } = require('./modules/users')
const {
  createTeam,
  createProject,
  createStage,
  getKVEnvs,
} = require('./modules/envs')
const { createTeam, listTeams, getTeam } = require('./modules/teams')

const { parseJWT } = require('./modules/auth')
const deta = require('./modules/db')

// process.env is not avail in workers, direct access like KV namespaces and secrets

module.exports.withRequiredName =
  (key, length = 3) =>
  async ({ content }) => {
    if (!content.name || content.name.length < length) {
      return respondError(
        HTTPError(
          `Invalid ${key} name: name must be at least ${length} characters`,
          400
        )
      )
    }
  }

/*
  ====[NOTE]
  - api convention is to wrap specific response in { payload: {} }
  - for specific entities, respond with their name (e.g. team or teams)
  - for create/update/delete, respond with key or name
 */

module.exports.root = ({ cf }) =>
  respondJSON({
    payload: {
      cli: 'pip install -U print-env --pre',
      'Web UI': 'wip',
      cf,
    },
  })

// UI handlers
module.exports.listAll = async ({ user }) => {
  try {
    const teams = await Promise.all(user.teams.map((key) => getTeam(key)))
    const teamProjects = await Promise.all(
      teams.map((t) =>
        deta
          .Base('projects')
          .fetch({ team: t.key }, {})
          .then(({ items }) => items)
      )
    )

    const projects = teamProjects.flat()

    const projectStages = await Promise.all(
      projects.map((p) =>
        deta
          .Base('stages')
          .fetch({ project: p.key }, {})
          .then(({ items }) => items)
      )
    )

    const stages = projectStages.flat()

    const payload = { teams, projects, stages }

    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listTeams = async ({ user }) => {
  try {
    const teams = listTeams({ user })
    return respondJSON({ payload: { teams } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createTeam = async ({ user, content: { name } }) => {
  try {
    const key = await createTeam({ user, name })
    return respondJSON({ payload: { key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.updateTeamName = async ({ user, content: { team, name } }) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    // TODO: owner or admin only
    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const key = await updateTeamName({ team, name })
    return respondJSON({ payload: { key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listProjects = async ({ url, user }) => {
  try {
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

module.exports.createProject = async ({ content: { team, name }, user }) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const payload = await createProject({ team, project: name })

    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listStages = async ({ query, user }) => {
  try {
    const { team, project, limit, last } = query
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400)
    }

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const payload = await deta
      .Base('stages')
      .fetch({ project: `${team}::${project}` }, { limit, last })
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createStage = async ({
  content: { team, project, name },
  user,
}) => {
  try {
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400)
    }

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const payload = await createStage({ team, project, stage: name })

    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listUsers = async ({ url, user }) => {
  try {
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
