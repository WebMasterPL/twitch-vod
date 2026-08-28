import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { getChannelVods } from '../../src/api/helix';
import type { Vod } from '../../src/api/types';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { VodCard } from '../../src/components/VodCard';
import { usePaginated } from '../../src/hooks/usePaginated';
import { getPositions } from '../../src/lib/playbackPositions';
import { colors, spacing } from '../../src/theme';

export default function ChannelVodsScreen() {
  const { id, name, login } = useLocalSearchParams<{
    id: string;
    name?: string;
    login?: string;
  }>();
  const router = useRouter();

  const vods = usePaginated<Vod>(
    (cursor, signal) => getChannelVods(id, cursor, signal),
    [id],
    Boolean(id)
  );

  const [resume, setResume] = useState<Record<string, number>>({});

  // Zapisane pozycje odtwarzania - rysujemy z nich pasek postepu na kaflach.
  useEffect(() => {
    let cancelled = false;
    const ids = vods.items.map((vod) => vod.id);
    if (ids.length === 0) return;

    void getPositions(ids).then((map) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [vodId, entry] of Object.entries(map)) {
        next[vodId] = entry.positionSeconds;
      }
      setResume(next);
    });

    return () => {
      cancelled = true;
    };
  }, [vods.items]);

  const openVod = useCallback(
    (vod: Vod) => {
      // Ekran odtwarzacza powstaje w kolejnym kroku - na razie tylko trasa.
      router.push({ pathname: '/watch/[vodId]', params: { vodId: vod.id } });
    },
    [router]
  );

  const title = name || (login ? `@${login}` : 'VOD-y');

  if (vods.loading) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <LoadingState label="Wczytuję VOD-y…" />
      </>
    );
  }

  if (vods.error) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <ErrorState error={vods.error} onRetry={vods.refresh} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={vods.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          vods.items.length === 0 && styles.emptyContainer,
        ]}
        renderItem={({ item }) => (
          <VodCard vod={item} resumeSeconds={resume[item.id]} onPress={() => openVod(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            title="Brak archiwalnych transmisji"
            hint="Ten kanał nie udostępnia VOD-ów albo wszystkie wygasły."
          />
        }
        ListFooterComponent={
          vods.loadingMore ? (
            <ActivityIndicator style={styles.footer} color={colors.accent} />
          ) : null
        }
        onEndReached={vods.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={vods.refreshing}
            onRefresh={vods.refresh}
            tintColor={colors.textMuted}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.sm },
  emptyContainer: { flexGrow: 1 },
  separator: { height: spacing.xs },
  footer: { paddingVertical: spacing.lg },
});
