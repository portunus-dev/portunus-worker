const deta = require('./db')

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
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')

  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  await Promise.all([
    users.update(
      { teams: users.util.append(team), admins: users.util.append(team) },
      user.key
    ),
    USERS.put(
      user.email,
      JSON.stringify({
        ...user,
        teams: [...user.teams, team],
        admins: [...user.admins, team],
      })
    ),
  ])
  return team
}

module.exports.listTeams = async ({ user }) =>
  await Promise.all([
    ...user.teams.map((key) =>
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

module.exports.getTeam = deta.Base('teams').get

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
  const { items: stages } = await deta
    .Base('stages')
    .fetch({ 'key?pfx': `${team}::` })

  await Promise.all(
    stages.map(
      async ({ key }) =>
        await Promise.all([deta.Base('stages').delete(key), KV.delete(key)])
    )
  )

  // delete projects
  const { items: projects } = await deta
    .Base('projects')
    .fetch({ 'key?pfx': `${team}::` })

  await Promise.all(
    projects.map(({ key }) => deta.Base('projects').delete(key))
  )

  //delete team
  await deta.Base('teams').delete(team)

  // update users
  const { items: users } = await deta
    .Base('users')
    .fetch([{ 'teams?contains': team }, { 'admins?contains': team }])

  const detaUsers = deta.Base('users')
  // TODO: make this "transactional"
  // TODO: unify with other user updates e.g. ./user.update
  await Promise.all(
    users.map(
      async (user) =>
        await Promise.all([
          detaUsers.update(
            {
              teams: user.teams.filter((o) => o === team),
              admins: user.admins.filter((o) => o === team),
            },
            user.key
          ),
          USERS.put(
            user.email,
            JSON.stringify({
              ...user,
              teams: user.teams.filter((o) => o === team),
              admins: user.admins.filter((o) => o === team),
            })
          ),
        ])
    )
  )

  return team
}
