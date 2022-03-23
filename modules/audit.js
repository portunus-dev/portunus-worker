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
  },
  env: {
    GET: 'Fetch for stage',
    PUT: 'Update for stage',
  },
}

const getQueryString = (query) =>
  Object.entries(query).length
    ? Object.entries(query)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : ''

const getParamsString = (params) =>
  Object.entries(params).length
    ? Object.entries(params)
        .map(([k, v]) => {
          if (k === 'updates') {
            return `${k}: add[${Object.keys(v.add).join(
              ','
            )}], edit[${Object.keys(v.edit).join(',')}], remove[${v.remove.join(
              ','
            )}]`
          }
          return `${k}: ${v}`
        })
        .join(', ')
    : ''

module.exports.convertRequestToHumanReadableString = ({
  apiPath,
  method,
  query,
  params = {},
}) => {
  console.log('---> THE api PATH!', apiPath, query, params)
  const text = (URL_METHOD_MAP[apiPath] || {})[method]
  console.log(text)
  if (text) {
    return `${apiPath} - ${text} - ${getQueryString(query)} ${getParamsString(
      params
    )}`
  }

  return 'Unknown operation'
}
