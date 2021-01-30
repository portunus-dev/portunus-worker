const { PROJECTS } = require('./compat')

module.exports.extractParams = (searchParams) => (...params) =>
  params.reduce((acc, k) => {
    const v = searchParams.getAll(k)
    if (!v.length) {
      return acc
    }
    acc[k] = v.length === 1 ? v[0] : v
    return acc
  }, {})

module.exports.parseProj = (proj) =>
  !isNaN(proj) && !isNaN(parseFloat(proj)) ? PROJECTS[proj] : proj

// TODO: use trained model (assisted through user labels)
module.exports.isSecret = (k) =>
  [
    'pass',
    'pw',
    'password',
    'secret',
    'token',
    'key',
    'code',
    'user',
    'id',
  ].some((v) => String(k).toLowerCase().includes(v))

module.exports.isHost = (k) => String(k).toLowerCase().includes('host')
