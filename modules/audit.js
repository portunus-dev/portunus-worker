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

module.exports.convertRequestToHumanReadableString = ({
  url,
  apiPath,
  method,
  params = {},
}) => {
  const normalizedApiPath = apiPath.replace(/^\/|\/$/g, '');

  const pathMap = URL_METHOD_MAP[normalizedApiPath];

  console.log(`Incoming apiPath: "${apiPath}", normalizedApiPath: "${normalizedApiPath}", method: "${method}"`);

  if (!pathMap) {
    console.error(`Unknown apiPath: "${normalizedApiPath}". Make sure it's correct and exists in URL_METHOD_MAP.`);
  }

  const text = pathMap ? pathMap[method] : undefined;

  if (!text) {
    console.error(`Unknown method "${method}" for apiPath "${normalizedApiPath}". Expected one of: ${Object.keys(pathMap || {})}`);
  }

  if (text) {
    console.log(`Matched apiPath: "${normalizedApiPath}" and method: "${method}"`);
    return `${normalizedApiPath} - ${text} - ${getQueryString(url) || ''} - ${getParamsString(params) || ''}`;
  }

  console.warn(`Returning "Unknown operation" for apiPath "${normalizedApiPath}" and method "${method}".`);
  return 'Unknown operation';
};

const getParamsString = (params) =>
  Object.entries(params)
    .map(([k, v]) => {
      if (k === 'updates') {
        return `add[${Object.keys(v.add).join(',')}], edit[${Object.keys(v.edit).join(',')}], remove[${v.remove.join(',')}]`;
      }
      if (typeof v === 'object') {
        return `${k}: ${JSON.stringify(v)}`;
      }
      return `${k}: ${v}`;
    })
    .join(', ');

module.exports.getAuditHistory = async ({ type, key }) => {
  const auditReport = await AUDIT_REPORT.get(`${type}::${key}`, 'json');

  const auditHistory = auditReport?.auditHistory || [];

  return auditHistory;
};

module.exports.logAudit = async (log) => {
  try {
    const logKey = `${log.api_path}::${log.user.email}::${Date.now()}`;
    await AUDIT_LOGS.put(logKey, JSON.stringify(log));
    console.log('Audit log saved:', logKey); // Optional log for successful storage
  } catch (error) {
    console.error('Error saving audit log:', error); // Error handling
  }
}
