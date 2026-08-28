import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getFollowedChannels, getFollowedStreams, getUsers } from '../../src/api/helix';
import type { FollowedChannel, LiveStream } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { ChannelRow } from '../../src/components/ChannelRow';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAsync } from '../../src/hooks/useAsync';
import { usePaginated } from '../../src/hooks/usePaginated';
import { colors, spacing } from '../../src/theme';

export default function FollowingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.userId;

  const channels = usePaginated<FollowedChannel>(
    (cursor, signal) => getFollowedChannels(userId!, cursor, signal),
    [userId],
    Boolean(userId)
  );

  // Osobne zapytanie - Helix nie zwraca statusu live razem z lista obserwowanych.
  const live = useAsync(
    (signal) => getFollowedStreams(userId!, undefined, signal),
    [userId],
    Boolean(userId)
  );

  const liveById = useMemo(() => {
    const map = new Map<string, LiveStream>();
    for (const stream of live.data?.data ?? []) map.set(stream.userId, stream);
    return map;
  }, [live.data]);

  // Avatary dochodza dopiero z /users - jedno zapytanie na zaladowana partie kanalow.
  const loadedIds = useMemo(
    () => channels.items.map((channel) => channel.broadcasterId),
    [channels.items]
  );

  const avatars = useAsync(
    (signal) => getUsers({ ids: loadedIds, signal }),
    [loadedIds.length],
    loadedIds.length > 0
  );

  const avatarById = useMemo(() => {
    const map = new Map<string, string>();
    for (const twitchUser of avatars.data ?? []) {
      map.set(twitchUser.id, twitchUser.profileImageUrl);
    }
    return map;
  }, [avatars.data]);

  // Na zywo na gorze, reszta alfabetycznie - kolejnosc z Helixa jest wg daty obserwacji.
  const sorted = useMemo(() => {
    return [...channels.items].sort((a, b) => {
      const aLive = liveById.has(a.broadcasterId) ? 0 : 1;
      const bLive = liveById.has(b.broadcasterId) ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return a.broadcasterName.localeCompare(b.broadcasterName, 'pl');
    });
  }, [channels.items, liveById]);

  const openChannel = useCallback(
    (channel: FollowedChannel) => {
      router.push({
        pathname: '/channel/[id]',
        params: {
          id: channel.broadcasterId,
          login: channel.broadcasterLogin,
          name: channel.broadcasterName,
        },
      });
    },
    [router]
  );

  const onRefresh = useCallback(() => {
    channels.refresh();
    live.reload();
  }, [channels, live]);

  if (channels.loading) return <LoadingState label="Wczytuję śledzone kanały…" />;
  if (channels.error) {
    return <ErrorState error={channels.error} onRetry={channels.refresh} />;
  }

  const liveCount = liveById.size;

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.broadcasterId}
      contentContainerStyle={sorted.length === 0 ? styles.emptyContainer : undefined}
      ListHeaderComponent={
        sorted.length > 0 ? (
          <Text style={styles.header}>
            {liveCount > 0
              ? `${liveCount} z ${sorted.length} kanałów na żywo`
              : `${sorted.length} śledzonych kanałów`}
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        const stream = liveById.get(item.broadcasterId);
        return (
          <ChannelRow
            displayName={item.broadcasterName}
            login={item.broadcasterLogin}
            avatarUrl={avatarById.get(item.broadcasterId)}
            live={
              stream
                ? {
                    title: stream.title,
                    gameName: stream.gameName,
                    viewerCount: stream.viewerCount,
                    startedAt: stream.startedAt,
                  }
                : undefined
            }
            onPress={() => openChannel(item)}
          />
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <EmptyState
          title="Nie śledzisz żadnych kanałów"
          hint="Znajdź kanał w zakładce Szukaj."
        />
      }
      ListFooterComponent={
        channels.loadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.accent} />
        ) : null
      }
      onEndReached={channels.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={channels.refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textMuted}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: { flexGrow: 1 },
  header: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  footer: { paddingVertical: spacing.lg },
});
