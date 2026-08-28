import { AuthError, revokeSession, signIn as runSignIn, validateToken } from './twitchAuth';
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from './tokenStore';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthState = {
  status: AuthStatus;
  session: StoredSession | null;
};

type Listener = (state: AuthState) => void;

let state: AuthState = { status: 'loading', session: null };
const listeners = new Set<Listener>();

function setState(next: AuthState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getState(): AuthState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Wczytuje sesje z SecureStore przy starcie i sprawdza, czy token jeszcze zyje. */
export async function bootstrap(): Promise<void> {
  const stored = await loadSession();
  if (!stored) {
    setState({ status: 'signedOut', session: null });
    return;
  }

  try {
    await validateToken(stored.accessToken);
    setState({ status: 'signedIn', session: stored });
  } catch {
    // Implicit grant nie daje refresh tokena - martwy token oznacza
    // wyczyszczenie SecureStore i powrot na ekran logowania.
    await clearSession();
    setState({ status: 'signedOut', session: null });
  }
}

export async function signIn(): Promise<void> {
  const session = await runSignIn();
  await saveSession(session);
  setState({ status: 'signedIn', session });
}

export async function signOut(): Promise<void> {
  const current = state.session;
  setState({ status: 'signedOut', session: null });
  await clearSession();
  if (current) await revokeSession(current);
}

/** Zwraca token do zapytania. Rzuca, gdy nikt nie jest zalogowany. */
export async function getAccessToken(): Promise<string> {
  const session = state.session;
  if (!session) {
    throw new AuthError('Brak zalogowanej sesji');
  }
  return session.accessToken;
}

/**
 * Wywolywane po odpowiedzi 401 z Helixa. Bez refresh tokena jedyna reakcja
 * to skasowanie sesji z SecureStore - bramka w app/_layout.tsx przekieruje
 * wtedy na ekran logowania.
 */
export async function invalidateSession(): Promise<never> {
  await signOut();
  throw new AuthError('Sesja wygasla - zaloguj sie ponownie');
}
