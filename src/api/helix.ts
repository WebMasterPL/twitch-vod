import { helixGet, helixGetPage } from './client';
import type {
  ChannelSearchResult,
  FollowedChannel,
  LiveStream,
  Page,
  TwitchUser,
  Vod,
} from './types';

/** Twitch podaje szablon miniatury z placeholderami na rozmiar. */
export function sizeThumbnail(template: string, width: number, height: number): string {
  return template
    .replace('%{width}', String(width))
    .replace('%{height}', String(height))
    .replace('{width}', String(width))
    .replace('{height}', String(height));
}

/** "1h2m3s" -> 3723. Twitch nie podaje czasu trwania w sekundach. */
export function parseDuration(duration: string): number {
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(duration.trim());
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

type RawFollowed = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  followed_at: string;
};

export function getFollowedChannels(
  userId: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<Page<FollowedChannel>> {
  return helixGetPage<RawFollowed, FollowedChannel>(
    '/channels/followed',
    { user_id: userId, first: 100, after: cursor },
    (raw) => ({
      broadcasterId: raw.broadcaster_id,
      broadcasterLogin: raw.broadcaster_login,
      broadcasterName: raw.broadcaster_name,
      followedAt: raw.followed_at,
    }),
    signal
  );
}

type RawStream = {
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
};

const mapStream = (raw: RawStream): LiveStream => ({
  userId: raw.user_id,
  userLogin: raw.user_login,
  userName: raw.user_name,
  gameName: raw.game_name,
  title: raw.title,
  viewerCount: raw.viewer_count,
  startedAt: raw.started_at,
  thumbnailUrl: raw.thumbnail_url,
});

/** Kanaly sledzone, ktore sa aktualnie na zywo. */
export function getFollowedStreams(
  userId: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<Page<LiveStream>> {
  return helixGetPage<RawStream, LiveStream>(
    '/streams/followed',
    { user_id: userId, first: 100, after: cursor },
    mapStream,
    signal
  );
}

/**
 * Transmisje wskazanych uzytkownikow. /search/channels zwraca is_live, ale nie
 * liczbe widzow - trzeba ja dobrac osobno.
 */
export async function getStreamsByUserIds(
  userIds: string[],
  signal?: AbortSignal
): Promise<LiveStream[]> {
  if (userIds.length === 0) return [];
  // Helix przyjmuje max 100 identyfikatorow na zapytanie.
  const body = await helixGet<{ data: RawStream[] }>(
    '/streams',
    { user_id: userIds.slice(0, 100), first: 100 },
    signal
  );
  return (body.data ?? []).map(mapStream);
}

type RawSearchChannel = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  game_name: string;
  is_live: boolean;
  thumbnail_url: string;
  started_at: string;
};

export function searchChannels(
  query: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<Page<ChannelSearchResult>> {
  return helixGetPage<RawSearchChannel, ChannelSearchResult>(
    '/search/channels',
    { query, first: 30, after: cursor },
    (raw) => ({
      id: raw.id,
      broadcasterLogin: raw.broadcaster_login,
      displayName: raw.display_name,
      gameName: raw.game_name,
      isLive: raw.is_live,
      thumbnailUrl: raw.thumbnail_url,
      startedAt: raw.started_at,
    }),
    signal
  );
}

type RawVideo = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  view_count: number;
  duration: string;
};

const mapVod = (raw: RawVideo): Vod => ({
  id: raw.id,
  userId: raw.user_id,
  userLogin: raw.user_login,
  userName: raw.user_name,
  title: raw.title,
  description: raw.description,
  createdAt: raw.created_at,
  publishedAt: raw.published_at,
  url: raw.url,
  thumbnailUrl: raw.thumbnail_url,
  viewCount: raw.view_count,
  duration: raw.duration,
  durationSeconds: parseDuration(raw.duration),
});

/** Archiwalne transmisje kanalu, od najnowszych. */
export function getChannelVods(
  userId: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<Page<Vod>> {
  return helixGetPage<RawVideo, Vod>(
    '/videos',
    { user_id: userId, type: 'archive', sort: 'time', first: 20, after: cursor },
    mapVod,
    signal
  );
}

export async function getVideoById(id: string, signal?: AbortSignal): Promise<Vod | null> {
  const page = await helixGetPage<RawVideo, Vod>('/videos', { id }, mapVod, signal);
  return page.data[0] ?? null;
}

type RawUser = {
  id: string;
  login: string;
  display_name: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
};

const mapUser = (raw: RawUser): TwitchUser => ({
  id: raw.id,
  login: raw.login,
  displayName: raw.display_name,
  description: raw.description,
  profileImageUrl: raw.profile_image_url,
  offlineImageUrl: raw.offline_image_url,
});

export async function getUsers(params: {
  ids?: string[];
  logins?: string[];
  signal?: AbortSignal;
}): Promise<TwitchUser[]> {
  const { ids, logins, signal } = params;
  if (!ids?.length && !logins?.length) return [];
  // Helix przyjmuje max 100 identyfikatorow na zapytanie.
  const body = await helixGet<{ data: RawUser[] }>(
    '/users',
    { id: ids?.slice(0, 100), login: logins?.slice(0, 100) },
    signal
  );
  return (body.data ?? []).map(mapUser);
}

export async function getUserByLogin(
  login: string,
  signal?: AbortSignal
): Promise<TwitchUser | null> {
  const users = await getUsers({ logins: [login], signal });
  return users[0] ?? null;
}
