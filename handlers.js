import jwt from '@tsndr/cloudflare-worker-jwt'
const { generateOTP, verifyOTP } = require('./modules/otp.js');

const { v4: uuidv4 } = require('uuid')

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

    content.name = content.name.toLowerCase();
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
      'Web UI': `${WEB_UI_URL}`,
      language: headers.get('Accept-Language'),
      cf,
    },
  })

module.exports.listAll = async ({ user }) => {
  try {
    const teams = await listTeams({ user });

    const teamProjects = await Promise.all(
      teams.map(async (t) => {
        const projects = await PROJECTS.list({ prefix: `${t.key}::` });
        
        const projectDataPromises = projects.keys.map(({ name }) => {
          return PROJECTS.get(name, 'json');
        });

        return Promise.all(projectDataPromises);
      })
    );

    const projects = teamProjects.flat();

    const projectStages = await Promise.all(
      projects.map(async (p) => {
        const stages = await STAGES.list({ prefix: `${p.key}::` });

        const stageDataPromises = stages.keys.map((stageKey) => {
          return STAGES.get(stageKey.name, 'json');
        });
    
        return Promise.all(stageDataPromises);
      })
    );
    
    const stages = projectStages.flat(); 

    const payload = { teams, projects, stages };

    return respondJSON({ payload });
  } catch (err) {
    return respondError(err);
  }
};


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
    await updateTeamName({ user, team, name })
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
      throw new HTTPError('Invalid project: project not supplied', 400);
    }

    const team = project.split('::')[0];

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403);
    }

    await deleteProject({ project, team });

    return respondJSON({ payload: { key: project } });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.listProjects = async ({ query, user }) => {
  try {
    const { team = user.teams[0].key } = query;

    const hasAccessToTeam = user.teams.some(t => t.key === team);

    if (!hasAccessToTeam) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    let projects = [];
    try {
      const result = await listProjects({ team });
      projects = result.items || [];
    } catch (e) {
      console.warn('Fetch error while listing projects:', e);
    }

    return respondJSON({ payload: { projects } });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.createProject = async ({ content: { team, name }, user }) => {
  try {
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400);
    }

    const hasAccessToTeam = user.teams.some(t => t.key === team);

    if (!hasAccessToTeam) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    const payload = await createProject({ team, project: name });

    return respondJSON({ payload });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.listStages = async ({ query, user }) => {
  try {
    const { team, project } = query;
    
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400);
    }

    const hasAccess = (user.teams || []).some((t) => t.key === team);
    if (!hasAccess) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    const payload = await listStages({ team, project });

    return respondJSON({ payload });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.createStage = async ({
  content: { team, project, name },
  user,
}) => {
  try {
    if (!team || !project) {
      throw new HTTPError('Invalid request: team or project not supplied', 400);
    }

    const hasAccess = (user.teams || []).some((t) => t.key === team);
    if (!hasAccess) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    const payload = await createStage({ team, project, stage: name });

    return respondJSON({ payload });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.deleteStage = async ({ content: { stage }, user }) => {
  try {
    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400);
    }

    const team = stage.split('::')[0];

    const isAdmin = (user.admins || []).includes(team);
    if (!isAdmin) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    await deleteStage(stage);

    return respondJSON({ payload: { key: stage } });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.updateStageVars = async ({
  content: { stage, updates },
  user,
}) => {
  try {
    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400)
    }

    const team = stage.split('::')[0]

    if (!user.teams.some(t => t.key === team)) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }    

    const changes = await updateStageVars({ stage, updates })

    return respondJSON({ payload: { key: stage, updates: changes } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.listUsers = async ({ query, user }) => {
  try {
    const { team = user.teams[0].key, limit, last } = query;

    if (!team) {
      throw new HTTPError('Invalid request: team not supplied', 400);
    }

    const hasAccess = (user.teams || []).some((t) => t.key === team);
    if (!hasAccess) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    const teamUsers = await listTeamUsers({ team, limit, last });

    return respondJSON({ payload: { items: teamUsers, count: teamUsers.length } });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.createUser = async ({ content: { email } }) => {
  try {
    if (!email || !EMAIL_REGEXP.test(email)) {
      throw new HTTPError('valid email is required', 400);
    }

    const lowercasedEmail = email.toLowerCase();

    const { key } = await createUser(lowercasedEmail);

    return respondJSON({ payload: { key } });
  } catch (err) {
    return respondError(err);
  }
};


module.exports.updateUserAudit = async ({ user, content: { audit } }) => {
  try {
    if (audit === undefined) {
      throw new HTTPError('Invalid request: audit not supplied', 400)
    }
    if (!BOOLEAN_VALUES.includes(audit)) {
      throw new HTTPError('Invalid request: invalid audit value', 400)
    }
    const booleanAudit = TRUE_VALUES.includes(audit) ? true : false
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

module.exports.addUserToTeam = async ({ content: { userEmail, team }, user }) => {
  try {
    userEmail = userEmail.toLowerCase();
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400)
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400)
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403)
    }

    let kvUser = await USERS.get(userEmail, { type: 'json' })

    if (!kvUser) {
      kvUser = await createUser(userEmail, { getKVUser: true })
    }

    const teamKey = team; 

    const fullTeamData = await TEAMS.get(teamKey, "json");
    
    if (!fullTeamData || !fullTeamData.key || !fullTeamData.name) {
      throw new Error('Failed to retrieve team data or invalid team structure.');
    }
    
    await addUserToTeam({ team: fullTeamData, user: kvUser });

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
    userEmail = userEmail.toLowerCase();
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

module.exports.addUserToAdmin = async ({ content: { userEmail, team }, user }) => {
  try {
    userEmail = userEmail.toLowerCase();
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400);
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400);
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403);
    }

    let kvUser = await USERS.get(userEmail, { type: 'json' });

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400);
    }

    const teamKey = team;

    const fullTeamData = await TEAMS.get(teamKey, "json");

    if (!fullTeamData || !fullTeamData.key || !fullTeamData.name) {
      throw new Error('Failed to retrieve team data or invalid team structure.');
    }

    await addUserToAdmin({ team: fullTeamData, user: kvUser });

    return respondJSON({ payload: { key: kvUser.key } });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.removeUserFromAdmin = async ({ content: { userEmail, team }, user }) => {
  try {
    userEmail = userEmail.toLowerCase();
    if (!team) {
      throw new HTTPError('Invalid team: team not supplied', 400);
    }

    if (!userEmail || !EMAIL_REGEXP.test(userEmail)) {
      throw new HTTPError('Invalid user: a valid email is required', 400);
    }

    if (!user.admins.includes(team)) {
      throw new HTTPError('Invalid access: team admin required', 403);
    }

    const kvUser = await USERS.get(userEmail, { type: 'json' });

    if (!kvUser) {
      throw new HTTPError('Invalid user: user not found', 400);
    }

    const fullTeamData = await TEAMS.get(team, "json");

    if (!fullTeamData) {
      throw new Error('Failed to retrieve team data.');
    }

    await removeUserFromAdmin({ team: team, user: kvUser });

    return respondJSON({ payload: { key: kvUser.key } });
  } catch (err) {
    return respondError(err);
  }
};


module.exports.deleteUser = async ({ user }) => {
  try {
    await deleteUser(user)

    return respondJSON({ payload: { key: user.key } })
  } catch (err) {
    return respondError(err)
  }
}

module.exports.getEnv = async ({ user, query }) => {
  try {
    const {
      team = user.teams[0]?.key,
      project: p,
      stage,
    } = query;

    if (!p) {
      throw new HTTPError('Invalid request: project not supplied', 400);
    }

    if (!stage) {
      throw new HTTPError('Invalid request: stage not supplied', 400);
    }

    const teamData = (user.teams || []).find((t) => t.key === team);
    if (!teamData) {
      throw new HTTPError('Invalid portnus-jwt: no team access', 403);
    }

    const vars = (await getKVEnvs({ team, p, stage })) || {};

    return respondJSON({
      payload: {
        vars,
        encrypted: false,
        user,
        team,
        project: p,
        stage,
      },
    });
  } catch (err) {
    return respondError(err);
  }
};

module.exports.getOTP = async ({ query, url, headers, cf = {} }) => {
  try {
    let { user, origin } = query
    user = user.toLowerCase();
    if (!user || !EMAIL_REGEXP.test(user)) {
      throw new HTTPError('User email not supplied', 400)
    }
    let u = await fetchUser(user)
    if (!u) {
      u = await createUser(user)
    } else if (!u.otp_secret) {
      u.otp_secret = uuidv4()
      if (u.otp_secret === u.jwt_uuid) {
        throw new Error('OTP secret and JWT UUID are the same')
      }
      u.updated = new Date()
      await updateUser(u)
    }
    let otp;
    otp = await generateOTP(u.otp_secret);
    const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    const expiresAt = new Date(Date.now() + timeRemaining * 1000);
    const { origin: _origin } = new URL(url)
    const defaultOrigin = `${_origin}/login`
    const locale = (headers.get('Accept-Language') || '').split(',')[0] || 'en'
    const timeZone = cf.timezone || 'UTC'
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
  } catch (error) {
    console.error("Error in getOTP: ", error);
    throw error;
  }
}

module.exports.login = async ({ query }) => {
  try {
    let { user, otp } = query;
    user = user.toLowerCase();
    if (!user || !otp) {
      return respondError(new HTTPError('User or OTP not supplied', 400));
    }
    const { email, jwt_uuid, otp_secret } = (await fetchUser(user)) || {
      teams: [],
    };
    if (!email || !otp_secret) {
      return respondError(new HTTPError(`${user} not found`, 404));
    }
    
    const isValid = await verifyOTP(otp, otp_secret);
    if (!isValid) {
      return respondError(new HTTPError('Invalid OTP', 403));
    }
    
    try {
      const token = await jwt.sign({ email, jwt_uuid }, TOKEN_SECRET);
      return respondJSON({ payload: { jwt: token } });
    } catch (err) {
      return respondError(new HTTPError('JWT token generation failed', 500));
    }
  } catch (err) {
    return respondError(new HTTPError('Internal server error', 500));
  }
};

module.exports.getToken = async ({ query }) => {
  let { user } = query
  user = user.toLowerCase();
  const { email, jwt_uuid } = (await getKVUser(user)) || {}

  const token = await jwt.sign({ email, jwt_uuid }, TOKEN_SECRET)

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
