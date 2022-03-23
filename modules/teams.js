const deta = require('./db')
const { addUserToTeam, removeUserFromTeam, addUserToAdmin } = require('./users')
const { deleteProject } = require('./projects')

/*
  TEAM
  - create = create team { key, name } and add user to it
  - retrieve = get all teams and admins for a single user
             = (deta wrapper) get team given a key
  - update = update team name
*/

module.exports.createTeam = async ({ name, user }) => {
  // create team metadata in deta Base
  const { key: team } = await deta.Base('teams').put({ name, audit: false })

  await addUserToTeam({ user, team })
  // add team, so that .teams is not overwritten by stale user
  const updatedUser = { ...user, teams: [...user.teams, team] }
  await addUserToAdmin({ user: updatedUser, team })

  return team
}

module.exports.listTeams = ({ user }) =>
  Promise.all([
    ...user.teams
      .filter((o) => !(user.admins || []).includes(o))
      .map((key) =>
        deta
          .Base('teams')
          .get(key)
          .then((p) => ({ ...p, admin: false }))
      ),
    ...(user.admins || []).map((key) =>
      deta
        .Base('teams')
        .get(key)
        .then((p) => ({ ...p, admin: true }))
    ),
  ])

module.exports.getTeam = (key) => deta.Base('teams').get(key)

module.exports.updateTeamName = ({ team, name }) => {
  deta.Base('teams').update(
    {
      name,
    },
    team
  )
}

module.exports.updateTeamAudit = ({ team, audit }) => {
  deta.Base('teams').update(
    {
      audit,
    },
    team
  )
}

// TODO: this should be transactional?
// TODO: update it with deleteStage, deleteProject, removeUserFromTeam functions
module.exports.deleteTeam = async ({ team }) => {
  // delete projects
  let projects = []
  try {
    ;({ items: projects } = await deta.Base('projects').fetch({ team }))
  } catch (e) {
    console.warn('Deta fetch error')
  }
  await Promise.all(projects.map(({ key }) => deleteProject(key)))

  //delete team
  await deta.Base('teams').delete(team)

  // update users
  let users = []
  try {
    ;({ items: users } = await deta
      .Base('users')
      .fetch([{ 'teams?contains': team }, { 'admins?contains': team }], {}))
  } catch (e) {
    console.warn('Deta fetch failed')
  }

  await Promise.all(users.map((user) => removeUserFromTeam({ user, team })))

  return team
}

module.exports.getAuditForTeam = async ({ team }) => {
  // TODO: other fiels, like
  const { auditHistory } = (await deta
    .Base('audit_report')
    .get('team::' + team)) || { auditHistory: [] }
  return auditHistory
}
