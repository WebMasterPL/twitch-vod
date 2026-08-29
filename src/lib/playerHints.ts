import { readJson, writeJson } from './storage';

const KEY = 'player.hints.v1';

type Hints = {
  /** Czy pokazano juz podpowiedz o logowaniu w oknie odtwarzacza. */
  seenLoginHint?: boolean;
};

let cache: Hints | null = null;

async function load(): Promise<Hints> {
  cache ??= await readJson<Hints>(KEY, {});
  return cache;
}

/**
 * Sesja Twitcha w WebView jest odrebna od Safari, wiec przy pierwszym wejsciu
 * w odtwarzacz uzytkownik nie jest tam zalogowany. Podpowiedz pokazujemy raz -
 * nie wykrywamy stanu sesji, bo embed tego nie raportuje.
 */
export async function shouldShowLoginHint(): Promise<boolean> {
  const hints = await load();
  return !hints.seenLoginHint;
}

export async function markLoginHintSeen(): Promise<void> {
  const hints = await load();
  if (hints.seenLoginHint) return;
  hints.seenLoginHint = true;
  cache = hints;
  await writeJson(KEY, hints);
}
