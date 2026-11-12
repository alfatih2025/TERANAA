import { auth } from './firebase';

const API_AUTH_TOKEN = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined)?.trim() ?? '';

export async function buildFirebaseAuthHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk untuk menggunakan AI.');

  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return headers;
}

export async function buildOptionalFirebaseAuthHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const headers = new Headers(extra);
  const user = auth.currentUser;
  if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return headers;
}

export function hasApiAuthToken() {
  return API_AUTH_TOKEN.length > 0;
}

export function buildApiHeaders(extra: HeadersInit = {}): HeadersInit {
  if (!API_AUTH_TOKEN) return extra;

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${API_AUTH_TOKEN}`,
    'x-api-key': API_AUTH_TOKEN,
  };

  if (extra instanceof Headers) {
    const merged = new Headers(extra);
    for (const [key, value] of Object.entries(authHeaders)) merged.set(key, value);
    return merged;
  }

  if (Array.isArray(extra)) {
    return [...extra, ...Object.entries(authHeaders)];
  }

  return {
    ...(extra as Record<string, string>),
    ...authHeaders,
  };
}
