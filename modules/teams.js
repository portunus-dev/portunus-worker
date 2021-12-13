const deta = require('./db')
const { addUserToTeam } = require('./users')

/*
  TEAM
  - create = create team { key, name } and add user to it
  - retrieve = get all teams and admins for a single user
             = (deta wrapper) get team given a key
  - update = update team name
*/

module.exports.createTeam = async ({ name, user }) => {
  // create team metadata in deta Base
  const { key: team } = await deta.Base('teams').put({ name })

  await addUserToTeam({ user, team })

  return team
}

module.exports.listTeams = ({ user }) =>
  Promise.all([
    ...user.teams
      .filter((o) => !user.admins.includes(o))
      .map((key) =>
        deta
          .Base('teams')
          .get(key)
          .then((p) => ({ ...p, admin: false }))
      ),
    ...user.admins.map((key) =>
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

// TODO: this should be transactional?
// TODO: update it with deleteStage, deleteProject, removeUserFromTeam functions
module.exports.deleteTeam = async ({ team }) => {
  // delete stages and KV
  let stages = []
  try {
    ;({ items: stages } = await deta
      .Base('stages')
      .fetch({ 'key?pfx': `${team}::` }, { limit: 1000, last: 0 }))
  } catch (e) {
    console.warn('Deta fetch failed')
  }

  await Promise.all(
    stages.map(
      async ({ key }) =>
        await Promise.all([deta.Base('stages').delete(key), KV.delete(key)])
    )
  )

  // delete projects
  let projects = []
  try {
    ;({ items: projects } = await deta
      .Base('projects')
      .fetch({ 'key?pfx': `${team}::` }, {}))
  } catch (e) {
    console.warn('Deta fetch failed')
  }

  await Promise.all(
    projects.map(({ key }) => deta.Base('projects').delete(key))
  )

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

  const detaUsers = deta.Base('users')
  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  await Promise.all(
    users.map(
      async (user) =>
        await Promise.all([
          detaUsers.update(
            {
              teams: user.teams.filter((o) => o !== team),
              admins: user.admins.filter((o) => o !== team),
            },
            user.key
          ),
          USERS.put(
            user.email,
            JSON.stringify({
              ...user,
              teams: user.teams.filter((o) => o !== team),
              admins: user.admins.filter((o) => o !== team),
            })
          ),
        ])
    )
  )

  return team
}
