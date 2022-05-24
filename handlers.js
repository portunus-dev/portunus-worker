const jwt = require('jsonwebtoken')
const { totp } = require('otplib')
const { v4: uuidv4 } = require('uuid')

totp.options = { step: 60 * 5 } // 5 minutes for the OTPs

const { HTTPError, respondError, respondJSON } = require('./modules/utils')
const {
  fetchUser, // TODO deprecated, use getUser
  updateUser,
  getKVUser,
  listTeamUsers,
  createUser,
  addUserToTeam,
  removeUserFromTeam,
  addUserToAdmin,
  removeUserFromAdmin,
  deleteUser,
} = require('./modules/users')
const {
  createStage,
  listStages,
  deleteStage,
  updateStageVars,
  getKVEnvs,
} = require('./modules/envs')
const {
  createTeam,
  listTeams,
  // getTeam,
  updateTeamName,
  updateTeamAudit,
  deleteTeam,
} = require('./modules/teams')
const {
  createProject,
  listProjects,
  // getProject,
  updateProjectName,
  deleteProject,
} = require('./modules/projects')
const { getAuditHistory } = require('./modules/audit')

const deta = require('./modules/db')

// W3C email regex
const EMAIL_REGEXP = new RegExp(
  /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
)
const BOOLEAN_VALUES = [1, 0, '1', '0', true, false, 'true', 'false']
const TRUE_VALUES = [1, '1', true, 'true']

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

module.exports.root = ({ headers, cf }) =>
  respondJSON({
    payload: {
      cli: 'pip install -U print-env --pre',
      'Web UI': 'https://portunus.netlify.app',
      language: headers.get('Accept-Language'),
      cf,
    },
  })

// UI handlers
module.exports.listAll = async ({ user }) => {
  try {
    const teams = await listTeams({ user })
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
    const teams = await listTeams({ user })
    return respondJSON({ payload: { teams } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createTeam = async ({ user, content: { name } }) => {
  try {
    const key = await createTeam({ user, name })
    return respondJSON({ payload: { key, name } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.updateTeamName = async ({ user, content: { team, name } }) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }
    await updateTeamName({ team, name })
    return respondJSON({ payload: { key: team } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.updateTeamAudit = async ({ user, content: { team, audit } }) => {
  try {
    if (audit === undefined) {
      throw new HTTPError('Invalid request: audit not supplied', 400)
    }
    if (!BOOLEAN_VALUES.includes(audit)) {
      throw new HTTPError('Invalid request: invalid audit value', 400)
    }

    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }
    await updateTeamAudit({
      team,
      audit: TRUE_VALUES.includes(audit),
    })
    return respondJSON({ payload: { key: team } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.deleteTeam = async ({ user, content: { team } }) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }
    await deleteTeam({ team })
    return respondJSON({ payload: { key: team } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listProjects = async ({ query, user }) => {
  try {
    const { team = user.teams[0] } = query
    if (team && !user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    let projects = []
    try {
      ;({ items: projects } = await listProjects({ team }))
    } catch (e) {
      console.warn('Deta fetch error', e)
    }

    return respondJSON({ payload: { projects } })
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

module.exports.updateProjectName = async ({
  user,
  content: { project, name },
}) => {
  try {
    if (!project) {
      throw new HTTPError('Invalid project: project not supplied', 400)
    }

    const team = project.split('::')[0]

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }
    await updateProjectName({ project, name })
    return respondJSON({ payload: { key: project } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.deleteProject = async ({ user, content: { project } }) => {
  try {
    if (!project) {
      throw new HTTPError('Invalid project: project not supplied', 400)
    }

    const team = project.split('::')[0]
    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    await deleteProject({ project })
    return respondJSON({ payload: { key: project } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listStages = async ({ query, user }) => {
  try {
    const { team, project } = query
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400)
    }

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const payload = await listStages({ team, project })

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

module.exports.deleteStage = async ({ content: { stage }, user }) => {
  try {
    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400)
    }

    const team = stage.split('::')[0]
    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    await deleteStage(stage)

    return respondJSON({ payload: { key: stage } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.updateStageVars = async ({
  content: { stage, updates },
  user,
}) => {
  try {
    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400)
    }

    const team = stage.split('::')[0] // {team}::{project}::{stage}

    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }

    const changes = await updateStageVars({ stage, updates })

    return respondJSON({ payload: { key: stage, updates: changes } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listUsers = async ({ query, user }) => {
  try {
    const { team = user.teams[0], limit, last } = query
    if (!team) {
      throw new HTTPError('Invalid request: team not supplied', 400)
    }
    if (!user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const payload = await listTeamUsers({ team, limit, last })
    return respondJSON({ payload })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.createUser = async ({ content: { email } }) => {
  try {
    if (!email || !EMAIL_REGEXP.test(email)) {
      throw new HTTPError('valid email is required', 400)
    }
    const { key } = await createUser(email)

    return respondJSON({ payload: { key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.updateUserAudit = async ({ user, content: { audit } }) => {
  try {
    if (audit === undefined) {
      throw new HTTPError('Invalid request: audit not supplied', 400)
    }
    if (!BOOLEAN_VALUES.includes(audit)) {
      throw new HTTPError('Invalid request: invalid audit value', 400)
    }
    const booleanAudit = TRUE_VALUES.includes(audit) ? true : false
    // TODO: generic route for user preferences?
    const update = {
      ...user,
      preferences: {
        ...user.preferences,
        audit: booleanAudit,
      },
    }

    await updateUser(update)

    return respondJSON({ payload: { key: user.key, audit: booleanAudit } })
  } catch (err) {
    console.error('updateUserAuditError', err)
    return respondError(err)
  }
}

module.exports.addUserToTeam = async ({
  content: { userEmail, team },
  user,
}) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    const kvUser = await USERS.get(userEmail, { type: 'json' })

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400)
    }

    await addUserToTeam({ team, user: kvUser })

    return respondJSON({ payload: { key: kvUser.key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.removeUserFromTeam = async ({
  content: { userEmail, team },
  user,
}) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    const kvUser = await USERS.get(userEmail, { type: 'json' })

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400)
    }

    await removeUserFromTeam({ team, user: kvUser })

    return respondJSON({ payload: { key: kvUser.key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.addUserToAdmin = async ({
  content: { userEmail, team },
  user,
}) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    const kvUser = await USERS.get(userEmail, { type: 'json' })

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400)
    }

    await addUserToAdmin({ team, user: kvUser })

    return respondJSON({ payload: { key: kvUser.key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.removeUserFromAdmin = async ({
  content: { userEmail, team },
  user,
}) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    const kvUser = await USERS.get(userEmail, { type: 'json' })

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400)
    }

    await removeUserFromAdmin({ team, user: kvUser })

    return respondJSON({ payload: { key: kvUser.key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.deleteUser = async ({ user }) => {
  try {
    await deleteUser(user)

    return respondJSON({ payload: { key: user.key } })
  } catch (err) {
    return respondError(err)
  }
}

// also shared for UI
module.exports.getEnv = async ({ user, query }) => {
  try {
    const {
      team = user.teams[0], // TODO: backward compatibility
      project: p,
      stage,
    } = query
    if (!p) {
      throw new HTTPError('Invalid request: project not supplied', 400)
    }
    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400)
    }
    // TODO: remove !team check in future after dropping backward compatibility
    if (!team || !user.teams.includes(team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403)
    }
    const vars = (await getKVEnvs({ team, p, stage })) || {}
    return respondJSON({
      payload: {
        vars,
        encrypted: false,
        user,
        team,
        project: p, // TODO: perhaps stick with `p` for frontend read use-cases
        stage,
      },
    })
  } catch (err) {
    return respondError(err)
  }
}

// Auth handlers
module.exports.getOTP = async ({ query, url, headers, cf = {} }) => {
  const { user, origin } = query // user is email
  if (!user || !EMAIL_REGEXP.test(user)) {
    return respondError(new HTTPError('User email not supplied', 400))
  }
  let u = await fetchUser(user)
  if (!u) {
    u = await createUser(user)
  } else if (!u.otp_secret) {
    // legacy user without otp_secret
    u.otp_secret = uuidv4()
    if (u.otp_secret === u.jwt_uuid) {
      // Note: this shouldn't happen anyway
      throw new Error('OTP secret and JWT UUID are the same')
    }
    u.updated = new Date()
    await updateUser(u)
  }
  // Use time-based OTP to avoid storing them in deta/KV
  const otp = totp.generate(u.otp_secret)
  const expiresAt = new Date(Date.now() + totp.timeRemaining() * 1000)
  // TODO: tricky for local dev as the origin is mapped to remote cloudflare worker
  const { origin: _origin } = new URL(url)
  const defaultOrigin = `${_origin}/login`
  // obtain locale and timezone from request for email `expiresAt` formatting
  const locale = (headers.get('Accept-Language') || '').split(',')[0] || 'en'
  const timeZone = cf.timezone || 'UTC'
  // send email with OTP
  // TODO: need to manually remove sendgrid tracking https://app.sendgrid.com/settings/tracking
  // TODO: need to programmatically turn it off always https://stackoverflow.com/a/63360103/158111
  // TODO: setup own SMTP server (mailu) or AWS SES for much cheaper delivery
  const plainEmail = [
    `OTP: ${otp}`,
    `Magic-Link: ${origin || defaultOrigin}?user=${user}&otp=${otp}`,
    `Expires at: ${expiresAt.toLocaleString(locale, {
      timeZone,
      timeZoneName: 'long',
    })}`,
  ].join('\n')
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${MAIL_PASS}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: u.email }] }],
      from: { email: 'dev@mindswire.com' },
      subject: 'Portunus Login OTP/Magic-Link',
      content: [
        {
          type: 'text/plain',
          value: plainEmail,
        },
      ],
    }),
  })
  return respondJSON({ payload: { message: `OTP/Magic-Link sent to ${user}` } })
}

module.exports.login = async ({ query }) => {
  const { user, otp } = query
  if (!user || !otp) {
    return respondError(new HTTPError('User or OTP not supplied', 400))
  }
  const { email, jwt_uuid, otp_secret } = (await fetchUser(user)) || {
    teams: [],
  }
  if (!email || !otp_secret) {
    return respondError(new HTTPError(`${user} not found`, 404))
  }
  const isValid = totp.verify({ secret: otp_secret, token: otp })
  if (!isValid) {
    return respondError(new HTTPError('Invalid OTP', 403))
  }
  const token = jwt.sign({ email, jwt_uuid }, TOKEN_SECRET)
  return respondJSON({ payload: { jwt: token } })
}

// legacy direct JWT through email
module.exports.getToken = async ({ query }) => {
  // TODO: need to mimic getEnv to support multiple-team user
  const { user } = query
  const { email, jwt_uuid } = (await getKVUser(user)) || {}

  // TODO: where do we generate jwt_uuid initially and how do we update it?
  // if (!jwt_uuid) {
  //   return respondError(new HTTPError(`${user} not found`, 404))
  // }

  const token = jwt.sign({ email, jwt_uuid }, TOKEN_SECRET)

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

module.exports.getAuditHistory = async ({ query: { type, key }, user }) => {
  try {
    if (!type || !['user', 'team'].includes(type)) {
      throw new HTTPError('Invalid type: "user" or "team" supported', 400)
    }

    if (type !== 'user' && !key) {
      throw new HTTPError('Invalid key: must be supplied', 400)
    }

    if (
      type === 'team' &&
      !user.admins.includes(key) &&
      !user.teams.includes(key)
    ) {
      throw new HTTPError('Invalid access: team membership required', 403)
    }

    const auditHistory = await getAuditHistory({
      type,
      key: type !== 'user' ? key : user.key,
    })

    return respondJSON({ payload: { auditHistory } })
  } catch (err) {
    console.error('getAuditHistoryError', err)
    return respondError(err)
  }
}
