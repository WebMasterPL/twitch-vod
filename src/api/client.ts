import { getAccessToken, invalidateSession } from '../auth/authManager';
import { HELIX_BASE, TWITCH_CLIENT_ID } from '../auth/config';
import { ApiError, NetworkError } from './errors';

type QueryValue = string | number | boolean | undefined | null | string[];
export type Query = Record<string, QueryValue>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path.startsWith('http') ? path : `${HELIX_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      // Helix przyjmuje powtorzone klucze dla list (np. ?id=1&id=2).
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown;
  let message = `Twitch API zwrocilo HTTP ${res.status}`;
  try {
    body = await res.json();
    const typed = body as { message?: string; error?: string };
    if (typed?.message) message = typed.message;
    else if (typed?.error) message = typed.error;
  } catch {
    // Odpowiedz bez JSON-a - zostajemy przy komunikacie z kodem HTTP.
  }
  return new ApiError(message, res.status, body);
}

async function request(
  path: string,
  query: Query | undefined,
  accessToken: string,
  signal?: AbortSignal
): Promise<Response> {
  try {
    return await fetch(buildUrl(path, query), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }
}

/**
 * Zapytanie do Helixa. Implicit grant nie daje refresh tokena, wiec 401
 * oznacza koniec sesji: czyscimy SecureStore i wracamy na ekran logowania.
 */
export async function helixGet<T>(
  path: string,
  query?: Query,
  signal?: AbortSignal
): Promise<T> {
  const token = await getAccessToken();
  const res = await request(path, query, token, signal);

  if (res.status === 401) {
    await invalidateSession();
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as T;
}

type HelixEnvelope<T> = {
  data: T[];
  pagination?: { cursor?: string };
};

/** Wariant dla endpointow zwracajacych { data, pagination }. */
export async function helixGetPage<TRaw, TOut>(
  path: string,
  query: Query | undefined,
  map: (raw: TRaw) => TOut,
  signal?: AbortSignal
): Promise<{ data: TOut[]; cursor?: string }> {
  const body = await helixGet<HelixEnvelope<TRaw>>(path, query, signal);
  return {
    data: (body.data ?? []).map(map),
    // Twitch potrafi zwrocic pusty obiekt pagination na ostatniej stronie.
    cursor: body.pagination?.cursor || undefined,
  };
}
