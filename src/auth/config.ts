import Constants from 'expo-constants';

/**
 * Konfiguracja OAuth. Wszystko z EXPO_PUBLIC_* jest wkompilowane w bundle,
 * wiec nie trzymamy tu niczego, co nie moze trafic na urzadzenie.
 *
 * UWAGA - w tym przeplywie wystepuja DWA rozne adresy powrotu:
 *
 *   AUTH_BRIDGE_URL  -> to, co dostaje Twitch jako redirect_uri (HTTPS).
 *   APP_CALLBACK_URL -> to, na co nasluchuje ASWebAuthenticationSession
 *                       i czym strona-pomost otwiera aplikacje.
 *
 * Pomylenie ich konczy sie albo bledem "redirect mismatch" po stronie
 * Twitcha, albo oknem logowania, ktore nigdy sie nie zamyka.
 */

/**
 * Obcinamy biale znaki przy kazdym odczycie.
 *
 * Sekrety GitHub Actions zachowuja wartosc doslownie - `echo x | gh secret set`
 * albo skopiowanie identyfikatora razem z koncem linii zostawia na koncu "\n".
 * Taki client_id trafia do URL-a jako "...%0A" i Twitch odrzuca go z
 * komunikatem "invalid client", bez zadnej wskazowki, gdzie szukac przyczyny.
 */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function env(name: string): string | undefined {
  return clean(process.env[name]);
}

function extra(name: string): string | undefined {
  return clean(
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[name]
  );
}

export const TWITCH_CLIENT_ID =
  extra('twitchClientId') ?? env('EXPO_PUBLIC_TWITCH_CLIENT_ID') ?? '';

/**
 * Schemat powrotu ze strony-pomostu do aplikacji. Stala, nie zmienna
 * srodowiskowa i nie makeRedirectUri().
 *
 * Sideloadly przy podpisywaniu darmowym Apple ID nadpisuje CFBundleIdentifier
 * wlasnym ciagiem, ale wpisow w CFBundleURLSchemes nie rusza. Gdyby ten adres
 * byl pochodna bundle ID, po przepodpisaniu powrot z logowania trafialby na
 * schemat, ktorego aplikacja juz nie obsluguje.
 *
 * Ten adres NIE jest znany Twitchowi - trafia wylacznie do
 * WebBrowser.openAuthSessionAsync jako callback scheme.
 */
export const APP_CALLBACK_URL = 'twitchvod://auth';

/**
 * redirect_uri wysylany do Twitcha. Twitch Developer Console nie przyjmuje
 * custom scheme - wymaga HTTPS - wiec wskazujemy statyczna strone na GitHub
 * Pages, ktora przepisuje fragment adresu na APP_CALLBACK_URL.
 *
 * Musi byc wpisany w konsoli Twitcha znak w znak, razem z ukosnikiem na koncu.
 */
export const AUTH_BRIDGE_URL =
  extra('authBridgeUrl') ?? env('EXPO_PUBLIC_AUTH_BRIDGE_URL') ?? '';

/**
 * Strona-wrapper odtwarzacza, lezaca obok pomostu auth w tym samym repo
 * GitHub Pages. Wyprowadzamy ja z AUTH_BRIDGE_URL zamiast dodawac osobna
 * zmienna srodowiskowa - jeden adres do skonfigurowania, jeden sekret w CI.
 *
 * AUTH_BRIDGE_URL jest walidowany na koncowy ukosnik, wiec doklejenie
 * nazwy pliku jest bezpieczne. Pusty, gdy bridge nie jest skonfigurowany.
 */
export const PLAYER_WRAPPER_URL = AUTH_BRIDGE_URL
  ? `${AUTH_BRIDGE_URL}player.html`
  : '';

/** Adres wrappera dla konkretnego VOD-a. */
export function playerUrlForVod(vodId: string): string {
  if (!PLAYER_WRAPPER_URL) return '';
  return `${PLAYER_WRAPPER_URL}?v=${encodeURIComponent(vodId)}`;
}

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

  if (!AUTH_BRIDGE_URL) {
    problems.push(
      'Brak EXPO_PUBLIC_AUTH_BRIDGE_URL (.env) - adres strony-pomostu na GitHub Pages'
    );
  } else if (!AUTH_BRIDGE_URL.startsWith('https://')) {
    problems.push('EXPO_PUBLIC_AUTH_BRIDGE_URL musi zaczynac sie od https://');
  } else if (!AUTH_BRIDGE_URL.endsWith('/')) {
    // Twitch porownuje redirect_uri 1:1. Nie doklejamy ukosnika po cichu,
    // bo wtedy adres rozjechalby sie z tym wpisanym w konsoli Twitcha.
    problems.push(
      'EXPO_PUBLIC_AUTH_BRIDGE_URL musi konczyc sie ukosnikiem, ' +
        'dokladnie tak jak wpis w Twitch Developer Console'
    );
  }

  return problems;
}
