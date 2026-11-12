const DEFAULT_HEADER_NAMES = ['authorization', 'x-api-key'];

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getExpectedToken() {
  return readEnv('API_AUTH_TOKEN');
}

function extractProvidedToken(req) {
  const headers = req?.headers || {};
  const authHeader = headers.authorization || headers.Authorization || '';

  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  for (const headerName of DEFAULT_HEADER_NAMES) {
    const value = headers[headerName];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}

export function authError(res, message = 'Unauthorized') {
  return res.status(401).json({ error: message });
}

export function requireApiAuth(req, res, { allowAnonymous = false } = {}) {
  const expectedToken = getExpectedToken();
  if (allowAnonymous) return true;
  if (!expectedToken) {
    res.status(503).json({ error: 'API authentication is not configured' });
    return false;
  }

  const providedToken = extractProvidedToken(req);
  if (!providedToken || providedToken !== expectedToken) {
    authError(res);
    return false;
  }

  return true;
}

export function getAuthHeaders() {
  const token = getExpectedToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'x-api-key': token,
  };
}