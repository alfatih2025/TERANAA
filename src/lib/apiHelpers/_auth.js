import { createPublicKey, verify as verifySignature } from 'node:crypto';

const DEFAULT_HEADER_NAMES = ['authorization', 'x-api-key'];
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let firebasePublicKeys = null;
let firebaseKeysExpireAt = 0;

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

async function getFirebasePublicKeys() {
  if (firebasePublicKeys && Date.now() < firebaseKeysExpireAt) return firebasePublicKeys;

  const response = await fetch(FIREBASE_CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Firebase public key request failed (${response.status})`);

  const result = await response.json();
  if (!Array.isArray(result.keys)) throw new Error('Firebase public key response is invalid');

  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/i)?.[1] || 3600);
  firebasePublicKeys = new Map(result.keys.map((key) => [key.kid, key]));
  firebaseKeysExpireAt = Date.now() + maxAge * 1000;
  return firebasePublicKeys;
}

async function verifyFirebaseIdToken(idToken) {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const projectId = readEnv('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID') || 'nexa-69000';
  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== 'RS256' ||
    typeof header.kid !== 'string' ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== 'string' ||
    claims.sub.length === 0 ||
    claims.sub.length > 128 ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat > now ||
    !Number.isFinite(claims.auth_time) ||
    claims.auth_time > now
  ) {
    return null;
  }

  const keys = await getFirebasePublicKeys();
  const jwk = keys.get(header.kid);
  if (!jwk) return null;

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const validSignature = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  );
  return validSignature ? claims : null;
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

export async function getOptionalFirebaseAuth(req, res) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  const idToken = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!idToken) return null;

  try {
    const claims = await verifyFirebaseIdToken(idToken);
    if (!claims) {
      authError(res);
      return null;
    }

    return { uid: claims.sub, email: claims.email || null };
  } catch (error) {
    console.error('[API Auth] Firebase token verification failed:', error instanceof Error ? error.message : 'Unknown error');
    res.status(503).json({ error: 'Tidak dapat memverifikasi sesi login saat ini. Coba lagi.' });
    return null;
  }
}

export async function requireFirebaseAuth(req, res) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  const idToken = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!idToken) {
    authError(res);
    return null;
  }

  return getOptionalFirebaseAuth(req, res);
}

export async function requireFirebaseAdmin(req, res) {
  const user = await requireFirebaseAuth(req, res);
  if (!user) return null;

  const allowedEmails = (readEnv('FIREBASE_ADMIN_EMAILS') || 'alfatihwibowo264@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedEmails.includes((user.email || '').toLowerCase())) {
    authError(res, 'Akses administrator diperlukan');
    return null;
  }

  return user;
}

export function getAuthHeaders() {
  const token = getExpectedToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'x-api-key': token,
  };
}