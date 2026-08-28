import { readJson, writeJson } from './storage';

const KEY = 'playback.positions.v1';
/** Limit wpisow, zeby mapa nie rosla w nieskonczonosc. */
const MAX_ENTRIES = 500;
/** Ponizej tego progu nie ma sensu wznawiac. */
const MIN_RESUME_SECONDS = 15;
/** Tak blisko konca uznajemy VOD za obejrzany. */
const END_MARGIN_SECONDS = 60;

export type PlaybackPosition = {
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
};

type PositionMap = Record<string, PlaybackPosition>;

let cache: PositionMap | null = null;

async function load(): Promise<PositionMap> {
  cache ??= await readJson<PositionMap>(KEY, {});
  return cache;
}

export async function getPosition(vodId: string): Promise<PlaybackPosition | null> {
  const map = await load();
  return map[vodId] ?? null;
}

export async function getResumePosition(vodId: string): Promise<number> {
  const entry = await getPosition(vodId);
  if (!entry) return 0;
  if (entry.positionSeconds < MIN_RESUME_SECONDS) return 0;
  if (
    entry.durationSeconds > 0 &&
    entry.positionSeconds > entry.durationSeconds - END_MARGIN_SECONDS
  ) {
    return 0;
  }
  return entry.positionSeconds;
}

export async function savePosition(
  vodId: string,
  positionSeconds: number,
  durationSeconds: number
): Promise<void> {
  const map = await load();
  map[vodId] = { positionSeconds, durationSeconds, updatedAt: Date.now() };

  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    const stale = keys
      .sort((a, b) => map[a].updatedAt - map[b].updatedAt)
      .slice(0, keys.length - MAX_ENTRIES);
    for (const key of stale) delete map[key];
  }

  cache = map;
  await writeJson(KEY, map);
}

export async function getPositions(vodIds: string[]): Promise<PositionMap> {
  const map = await load();
  const result: PositionMap = {};
  for (const id of vodIds) {
    if (map[id]) result[id] = map[id];
  }
  return result;
}
