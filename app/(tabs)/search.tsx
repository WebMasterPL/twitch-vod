import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getStreamsByUserIds, searchChannels } from '../../src/api/helix';
import type { ChannelSearchResult } from '../../src/api/types';
import { EmptyState, ErrorState } from '../../src/components/StateViews';
import { ChannelRow } from '../../src/components/ChannelRow';
import { useAsync } from '../../src/hooks/useAsync';
import { usePaginated } from '../../src/hooks/usePaginated';
import { colors, radius, spacing } from '../../src/theme';

/** Opoznienie, zeby nie strzelac do Helixa przy kazdej literze. */
const DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const trimmed = input.trim();
    const timer = setTimeout(() => setQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const results = usePaginated<ChannelSearchResult>(
    (cursor, signal) => searchChannels(query, cursor, signal),
    [query],
    query.length > 0
  );

  // /search/channels nie zwraca liczby widzow - dobieramy ja z /streams
  // dla tych wynikow, ktore sa akurat na zywo.
  const liveIds = useMemo(
    () => results.items.filter((item) => item.isLive).map((item) => item.id),
    [results.items]
  );

  const liveStreams = useAsync(
    (signal) => getStreamsByUserIds(liveIds, signal),
    [liveIds.join(',')],
    liveIds.length > 0
  );

  const viewersById = useMemo(() => {
    const map = new Map<string, number>();
    for (const stream of liveStreams.data ?? []) map.set(stream.userId, stream.viewerCount);
    return map;
  }, [liveStreams.data]);

  const openChannel = useCallback(
    (channel: ChannelSearchResult) => {
      router.push({
        pathname: '/channel/[id]',
        params: {
          id: channel.id,
          login: channel.broadcasterLogin,
          name: channel.displayName,
        },
      });
    },
    [router]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Nazwa kanału"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Szukaj kanału"
        />
        {input.length > 0 ? (
          <Pressable onPress={() => setInput('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {query.length === 0 ? (
        <EmptyState title="Wyszukaj kanał" hint="Wpisz nazwę kanału, żeby zobaczyć jego VOD-y." />
      ) : results.error ? (
        <ErrorState error={results.error} onRetry={results.refresh} />
      ) : results.loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accent} />
      ) : (
        <FlatList
          data={results.items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ChannelRow
              displayName={item.displayName}
              login={item.broadcasterLogin}
              avatarUrl={item.thumbnailUrl}
              subtitle={item.gameName || `@${item.broadcasterLogin}`}
              live={
                item.isLive
                  ? {
                      title: item.gameName || 'Na żywo',
                      gameName: item.gameName,
                      viewerCount: viewersById.get(item.id),
                      startedAt: item.startedAt,
                    }
                  : undefined
              }
              onPress={() => openChannel(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState title="Brak wyników" hint={`Nic nie pasuje do „${query}”.`} />
          }
          ListFooterComponent={
            results.loadingMore ? (
              <ActivityIndicator style={styles.loader} color={colors.accent} />
            ) : null
          }
          onEndReached={results.loadMore}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },
  loader: { paddingVertical: spacing.xl },
});
