/**
 * Konfiguracja OAuth. Wszystko z EXPO_PUBLIC_* jest wkompilowane w bundle,
 * wiec nie trzymamy tu niczego, co nie moze trafic na urzadzenie.
 */

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const TWITCH_CLIENT_ID = env('EXPO_PUBLIC_TWITCH_CLIENT_ID') ?? '';

/**
 * Schemat powrotu z OAuth. Stala, nie zmienna srodowiskowa i nie
 * makeRedirectUri().
 *
 * Sideloadly przy podpisywaniu darmowym Apple ID nadpisuje CFBundleIdentifier
 * wlasnym ciagiem, ale wpisow w CFBundleURLSchemes nie rusza. Gdyby redirect
 * byl pochodna bundle ID, po przepodpisaniu Twitch odsylalby na schemat,
 * ktorego aplikacja juz nie obsluguje - logowanie wisialoby na pustym oknie.
 * Dlatego uzywamy krotkiego "twitchvod", niezaleznego od identyfikatora.
 *
 * Musi byc identyczny ze wpisem w OAuth Redirect URLs w Twitch Developer
 * Console - Twitch porownuje string 1:1, bez normalizacji slashy.
 */
export const TWITCH_REDIRECT_URI = 'twitchvod://auth';

export const SCOPES = ['user:read:follows'];

export const TWITCH_ENDPOINTS = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke',
  validate: 'https://id.twitch.tv/oauth2/validate',
} as const;

export const HELIX_BASE = 'https://api.twitch.tv/helix';

/** Zwraca liste brakow w konfiguracji - puste = wszystko gotowe. */
export function configProblems(): string[] {
  const problems: string[] = [];
  if (!TWITCH_CLIENT_ID) {
    problems.push('Brak EXPO_PUBLIC_TWITCH_CLIENT_ID (.env)');
  }
  return problems;
}
