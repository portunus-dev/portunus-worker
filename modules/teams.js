const deta = require('./db')

/*
  TEAM
  - create = create team { key, name } and add user to it
  - retrieve = get all teams and admins for a single user
             = (deta wrapper) get team given a key
  - update = update team name
*/

// TODO: designate team.owner, who can manage admins, who can change name and add users
module.exports.createTeam = async ({ name, user }) => {
  // create team metadata in deta Base
  const { key: team } = await deta.Base('teams').put({ name })
  // update user in both deta Base and Cloudflare KV
  const users = deta.Base('users')
  // TODO: make this "transactional"
  await Promise.all([
    users.update({ teams: users.util.append(team) }, user.key),
    USERS.put(
      user.email,
      JSON.stringify({ ...user, teams: [...user.teams, team] })
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
