import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getVideoById } from '../../src/api/helix';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, formatDuration } from '../../src/lib/format';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Zaslepka odtwarzacza. Warstwa playbacku (GQL PlaybackAccessToken -> usher -> expo-video)
 * powstaje w kolejnym kroku; ten ekran potwierdza, ze nawigacja i dane VOD-a dzialaja.
 */
export default function WatchScreen() {
  const { vodId } = useLocalSearchParams<{ vodId: string }>();

  const vod = useAsync((signal) => getVideoById(vodId, signal), [vodId], Boolean(vodId));

  if (vod.loading) return <LoadingState label="Wczytuję VOD…" />;
  if (vod.error) return <ErrorState error={vod.error} onRetry={vod.reload} />;
  if (!vod.data) return <ErrorState error={new Error('Nie znaleziono VOD-a')} />;

  const video = vod.data;

  return (
    <>
      <Stack.Screen options={{ title: video.userName }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>Odtwarzacz w budowie</Text>
          <Text style={styles.placeholderHint}>
            Kolejny krok: playback access token, HLS z usher.ttvnw.net i expo-video.
          </Text>
        </View>

        <Text style={styles.title}>{video.title || 'Bez tytułu'}</Text>
        <Text style={styles.meta}>
          {`${formatDate(video.publishedAt || video.createdAt)} · ${formatDuration(
            video.durationSeconds
          )}`}
        </Text>
        <Text style={styles.meta}>ID: {video.id}</Text>
        {video.description ? (
          <Text style={styles.description}>{video.description}</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  placeholder: {
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  placeholderTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  placeholderHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  description: { color: colors.text, fontSize: 14, marginTop: spacing.md, lineHeight: 20 },
});
