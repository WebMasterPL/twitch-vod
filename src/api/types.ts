export type Page<T> = {
  data: T[];
  /** Kursor do nastepnej strony. Brak = koniec listy. */
  cursor?: string;
};

export type FollowedChannel = {
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  followedAt: string;
};

export type LiveStream = {
  userId: string;
  userLogin: string;
  userName: string;
  gameName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
};

export type ChannelSearchResult = {
  id: string;
  broadcasterLogin: string;
  displayName: string;
  gameName: string;
  isLive: boolean;
  thumbnailUrl: string;
  startedAt: string;
};

export type Vod = {
  id: string;
  userId: string;
  userLogin: string;
  userName: string;
  title: string;
  description: string;
  createdAt: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string;
  viewCount: number;
  /** Sformatowany przez Twitcha, np. "1h2m3s". */
  duration: string;
  durationSeconds: number;
};

export type TwitchUser = {
  id: string;
  login: string;
  displayName: string;
  description: string;
  profileImageUrl: string;
  offlineImageUrl: string;
};
