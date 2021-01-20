const { PROJECTS } = require('./compat')

module.exports.extractParams = searchParams => (...params) =>
  params.reduce((acc, k) => {
    const v = searchParams.getAll(k)
    if (!v.length) {
      return acc
    }
    acc[k] = v.length === 1 ? v[0] : v
    return acc
  }, {})

module.exports.parseProj = proj =>
  !isNaN(proj) && !isNaN(parseFloat(proj)) ? PROJECTS[proj] : proj
