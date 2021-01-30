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
const isSecret = (k) =>
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

const isHost = (k) => String(k).toLowerCase().includes('host')

const isARN = (k) => String(k).toLowerCase().includes('arn')

const maskValue = (_v) => {
  if (!_v) {
    return _v
  }
  const v = String(_v)
  const m = v.replace(/./g, '*') // masked
  const c = Math.min(4, Math.floor(v.length / 4)) // cutoff
  const f = Math.min(v.length - c, 10) // filler
  return v.substring(0, c) + m.substring(0, f) + v.substring(v.length - c)
}

const maskHost = (h, isURL = false) =>
  h
    .split('.')
    .map((v, i, a) => {
      const c = Math.floor(v.length / 2)
      if (i < a.length - 2) {
        if (isURL) {
          return v.substring(0, c) + (c > 0 ? '__redacted' : '')
        }
        return maskValue(v)
      }
      return v
    })
    .join('.')

const maskURL = (_u, isSec = false) => {
  const u = new URL(_u)
  const p = u.protocol
  u.protocol = 'https'
  if (!isSec && !u.username && !u.password) {
    return _u
  }
  u.username = u.username ? '**REDACTED_USER**' : u.username
  u.password = u.password ? '**REDACTED_PASS**' : u.password
  u.hostname =
    isSec || u.username || u.password ? maskHost(u.hostname, true) : u.hostname
  u.pathname = isSec || u.username || u.password ? '__redacted' : u.pathname
  u.protocol = p
  return u.href
}

const maskARN = (v) =>
  v
    .split(':')
    .map((v) => (isNaN(v) || isNaN(parseFloat(v)) ? v : maskValue(v)))
    .join(':')

module.exports.hideValues = ({ value, metadata }) =>
  Object.entries(value)
    .map(([k, v]) => {
      const isSec = isSecret(k) || ((metadata || {}).secrets || []).includes(k)
      try {
        const url = maskURL(v)
        return [k, url]
      } catch (_) {
        // fallthrough
      }
      if (isSec) {
        return [k, maskValue(v)]
      }
      if (isHost(k)) {
        return [k, maskHost(v)]
      }
      if (isARN(k)) {
        return [k, maskARN(v)]
      }
      return [k, v]
    })
    .reduce((acc, [k, v]) => {
      acc[k] = v
      return acc
    }, {})
