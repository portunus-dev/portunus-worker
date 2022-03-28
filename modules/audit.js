const deta = require('./db')

module.exports.minimalLog = ({ method, url, query, body }) => ({
  method,
  url,
  query,
  body,
})

module.exports.withLogging = (req) => {
  if (req._log) {
    // "singleton"
    return
  }
  const { cf, headers: _headers } = req
  // build headers object
  const headers = {}
  for (const [key, value] of _headers) {
    headers[key] = value
  }
  req._log = {
    ...this.minimalLog(req),
    headers,
    cf,
    start: Date.now(),
  }
}

const URL_METHOD_MAP = {
  all: {
    GET: 'Fetch for user',
  },
  user: {},
  team: {
    GET: 'Fetch for user',
    POST: 'Create',
    DELETE: 'Delete',
    PUT: 'Update name',
  },
  project: {
    GET: 'Fetch for team',
    POST: 'Create',
    DELETE: 'Delete',
    PUT: 'Update name',
  },
  stage: {
    GET: 'Fetch for project',
    POST: 'Create',
    DELETE: 'Delete',
    PUT: 'Update',
  },
  env: {
    GET: 'Fetch for stage',
    PUT: 'Update for stage',
  },
}

const getQueryString = (query) => {
  const url = new URL(query)
  return url.search
}

const getParamsString = (params) =>
  Object.entries(params)
    .map(([k, v]) => {
      if (k === 'updates') {
        return `add[${Object.keys(v.add).join(',')}], edit[${Object.keys(
          v.edit
        ).join(',')}], remove[${v.remove.join(',')}]`
      }
      return `${k}: ${v}`
    })
    .join(', ')

module.exports.convertRequestToHumanReadableString = ({
  url,
  apiPath,
  method,
  params = {},
}) => {
  const text = (URL_METHOD_MAP[apiPath] || {})[method]
  if (text) {
    return `${apiPath} - ${text} - ${getQueryString(url)} - ${getParamsString(
      params
    )}`
  }

  return 'Unknown operation'
}

module.exports.getAuditHistory = async ({ type, key }) => {
  // TODO: other fiels, like
  const { auditHistory = [] } =
    (await deta.Base('audit_report').get(`${type}::` + key)) || {}
  return auditHistory
}
