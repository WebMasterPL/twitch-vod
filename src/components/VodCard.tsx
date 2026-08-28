import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sizeThumbnail } from '../api/helix';
import type { Vod } from '../api/types';
import { formatDate, formatDuration, formatViewers } from '../lib/format';
import { colors, radius, spacing } from '../theme';

type Props = {
  vod: Vod;
  onPress: () => void;
};

// Pasek postepu wrocil by tu, gdyby odtwarzacz zaczal zapisywac pozycje.
// Warstwa danych czeka gotowa w src/lib/playbackPositions.ts.
export function VodCard({ vod, onPress }: Props) {
  const thumbnail = sizeThumbnail(vod.thumbnailUrl, 320, 180);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={vod.title}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={{ uri: thumbnail }}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(vod.durationSeconds)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {vod.title || 'Bez tytułu'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {`${formatDate(vod.publishedAt || vod.createdAt)} · ${formatViewers(
            vod.viewCount
          )} wyświetleń`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  thumbWrap: {
    width: 160,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceHigh,
  },
  thumb: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  durationText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  body: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12 },
});
