const q = require('./graphql')

// TODO:
// Fauna resolver to get team by ID AND user ID
// which resolves the access correlation problem in one query
module.exports.getProjectsByTeam = (id) => {
  const index = 'findTeamByID'
  const query = `
    query($id: ID!) {
      ${index}(id: $id) {
        _id
        _ts
        name
        projects(_size: 100) {
          data {
            _id
            _ts
            name
            stages(_size: 50) {
              data {
                _id
                _ts
                name
              }
            }
          }
        }
      }
    }
  `
  const variables = { id }
  return q({ index, query, variables })
}
