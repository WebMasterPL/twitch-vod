import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import {
  APP_CALLBACK_URL,
  AUTH_BRIDGE_URL,
  HELIX_BASE,
  SCOPES,
  TWITCH_CLIENT_ID,
  TWITCH_ENDPOINTS,
  configProblems,
} from './config';
import type { StoredSession } from './tokenStore';

WebBrowser.maybeCompleteAuthSession();

export class AuthError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Uzytkownik zamknal okno logowania - nie jest to blad do pokazania jako awaria. */
export class AuthCancelled extends Error {
  constructor() {
    super('Logowanie anulowane');
    this.name = 'AuthCancelled';
  }
}

type ValidateResponse = {
  client_id: string;
  login: string;
  scopes: string[] | null;
  user_id: string;
  expires_in: number;
};

/**
 * /oauth2/validate jest jedynym pewnym zrodlem prawdy o tokenie:
 * mowi czy zyje, do kogo nalezy i ile mu zostalo.
 */
export async function validateToken(accessToken: string): Promise<ValidateResponse> {
  const res = await fetch(TWITCH_ENDPOINTS.validate, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    throw new AuthError(`Token odrzucony przez Twitcha (HTTP ${res.status})`);
  }
  return (await res.json()) as ValidateResponse;
}

type HelixUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

async function fetchSelf(accessToken: string): Promise<HelixUser | null> {
  const res = await fetch(`${HELIX_BASE}/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: HelixUser[] };
  return body.data?.[0] ?? null;
}

async function buildSession(
  accessToken: string,
  expiresInSeconds: number | undefined
): Promise<StoredSession> {
  const info = await validateToken(accessToken);
  const self = await fetchSelf(accessToken);
  const ttl = expiresInSeconds ?? info.expires_in;

  return {
    accessToken,
    expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : undefined,
    scopes: info.scopes ?? [],
    userId: info.user_id,
    login: info.login,
    displayName: self?.display_name ?? info.login,
    profileImageUrl: self?.profile_image_url,
  };
}

function assertConfigured(): void {
  const problems = configProblems();
  if (problems.length > 0) {
    throw new AuthError(problems.join('\n'));
  }
}

/** Losowy state do powiazania odpowiedzi z tym konkretnym zadaniem. */
async function createState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Wyciaga parametry z adresu powrotnego.
 *
 * Token przychodzi we fragmencie (po #), ale bledy Twitch potrafi zwrocic
 * w query stringu, wiec czytamy oba i laczymy - fragment ma pierwszenstwo.
 * Rozbijamy recznie zamiast przez URL, bo custom scheme bywa parsowany
 * niekonsekwentnie miedzy silnikami.
 */
function parseCallbackParams(url: string): URLSearchParams {
  const merged = new URLSearchParams();

  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  const withoutFragment = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutFragment.indexOf('?');
  const query = queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : '';

  for (const source of [query, fragment]) {
    if (!source) continue;
    for (const [key, value] of new URLSearchParams(source)) {
      merged.set(key, value);
    }
  }

  return merged;
}

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    // Twitch dostaje adres strony-pomostu (HTTPS), nie schemat aplikacji.
    redirect_uri: AUTH_BRIDGE_URL,
    response_type: 'token',
    scope: SCOPES.join(' '),
    state,
    // Twitch domyslnie pomija ekran zgody przy ponownym logowaniu; wymuszamy go,
    // zeby dalo sie swiadomie przelaczyc konto.
    force_verify: 'true',
  });
  return `${TWITCH_ENDPOINTS.authorization}?${params.toString()}`;
}

/**
 * Implicit grant przez strone-pomost.
 *
 * Twitch -> AUTH_BRIDGE_URL (HTTPS, GitHub Pages) -> APP_CALLBACK_URL.
 * Strona-pomost przepisuje fragment adresu 1:1, wiec token nigdy nie trafia
 * do zadania HTTP - przegladarki nie wysylaja fragmentu na serwer.
 *
 * Nie ma refresh tokena - po wygasnieciu (ok. 60 dni) albo po odpowiedzi 401
 * z Helixa czyscimy sesje i wracamy na ekran logowania. Authorization Code
 * odpada, bo Twitch wymaga przy wymianie kodu client_secret, a ten nie moze
 * trafic do bundla aplikacji sideloadowanej.
 */
export async function signIn(): Promise<StoredSession> {
  assertConfigured();

  const state = await createState();

  const result = await WebBrowser.openAuthSessionAsync(
    buildAuthorizeUrl(state),
    // Callback scheme dla ASWebAuthenticationSession - to NIE jest redirect_uri.
    APP_CALLBACK_URL
  );

  // Zamkniecie okna krzyzykiem albo gestem wstecz.
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new AuthCancelled();
  }
  if (result.type !== 'success') {
    throw new AuthError('Logowanie nie powiodlo sie');
  }

  const params = parseCallbackParams(result.url);

  const error = params.get('error');
  if (error) {
    // Uzytkownik kliknal "Odmow" na ekranie zgody Twitcha.
    if (error === 'access_denied') {
      throw new AuthCancelled();
    }
    // URLSearchParams samo dekoduje %XX i "+", wiec opis jest juz czytelny.
    const description = params.get('error_description');
    throw new AuthError(description || error);
  }

  const returnedState = params.get('state');
  if (!returnedState || returnedState !== state) {
    throw new AuthError(
      'Niezgodny parametr state - odpowiedz nie pasuje do zadania logowania.'
    );
  }

  const accessToken = params.get('access_token');
  if (!accessToken) {
    throw new AuthError('Twitch nie zwrocil access_token');
  }

  const expiresIn = Number(params.get('expires_in'));
  return buildSession(accessToken, Number.isFinite(expiresIn) ? expiresIn : undefined);
}

export async function revokeSession(session: StoredSession): Promise<void> {
  try {
    await fetch(TWITCH_ENDPOINTS.revocation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        token: session.accessToken,
      }).toString(),
    });
  } catch {
    // Wylogowanie lokalne musi sie udac nawet bez sieci.
  }
}
