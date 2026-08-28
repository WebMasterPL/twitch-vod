import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import {
  HELIX_BASE,
  SCOPES,
  TWITCH_CLIENT_ID,
  TWITCH_ENDPOINTS,
  TWITCH_REDIRECT_URI,
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

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: TWITCH_ENDPOINTS.authorization,
  revocationEndpoint: TWITCH_ENDPOINTS.revocation,
};

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

/**
 * Implicit grant: Twitch zwraca access_token bezposrednio we fragmencie
 * redirectu. Nie ma refresh tokena - po wygasnieciu (ok. 60 dni) albo po
 * odpowiedzi 401 z Helixa czyscimy sesje i wracamy na ekran logowania.
 *
 * Authorization Code odpada, bo Twitch wymaga przy wymianie kodu
 * client_secret, a ten nie moze trafic do bundla aplikacji sideloadowanej.
 */
export async function signIn(): Promise<StoredSession> {
  assertConfigured();

  const request = new AuthSession.AuthRequest({
    clientId: TWITCH_CLIENT_ID,
    redirectUri: TWITCH_REDIRECT_URI,
    scopes: SCOPES,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
    // Twitch domyslnie pomija ekran zgody przy ponownym logowaniu; wymuszamy go,
    // zeby dalo sie swiadomie przelaczyc konto.
    extraParams: { force_verify: 'true' },
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new AuthCancelled();
  }
  if (result.type !== 'success') {
    const description =
      result.type === 'error'
        ? result.error?.description ?? result.error?.message
        : undefined;
    throw new AuthError(description ?? 'Logowanie nie powiodlo sie');
  }

  const accessToken = result.params.access_token ?? result.authentication?.accessToken;
  if (!accessToken) {
    throw new AuthError('Twitch nie zwrocil access_token');
  }

  const expiresIn = Number(result.params.expires_in);
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
