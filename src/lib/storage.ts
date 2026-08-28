import AsyncStorage from '@react-native-async-storage/async-storage';

/** Cienka warstwa nad AsyncStorage z serializacja JSON i bezpiecznym fallbackiem. */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Zapis stanu pomocniczego nie moze wywrocic aplikacji.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // jw.
  }
}
