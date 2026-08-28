import * as SecureStore from 'expo-secure-store';

const KEY = 'twitch.session.v1';

export type StoredSession = {
  accessToken: string;
  /** Unix ms. Implicit grant zwraca zwykle ok. 60 dni. */
  expiresAt?: number;
  scopes: string[];
  userId: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
};

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken || !parsed?.userId) return null;
    return parsed;
  } catch {
    // Uszkodzony wpis traktujemy jak brak sesji, zeby nie zablokowac startu.
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
