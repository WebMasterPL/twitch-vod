import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatUptime, formatViewers } from '../lib/format';
import { colors, radius, spacing } from '../theme';

type Props = {
  displayName: string;
  login: string;
  avatarUrl?: string;
  live?: {
    title: string;
    gameName: string;
    viewerCount: number;
    startedAt: string;
  };
  subtitle?: string;
  onPress: () => void;
};

export function ChannelRow({
  displayName,
  login,
  avatarUrl,
  live,
  subtitle,
  onPress,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Kanał ${displayName}${live ? ', na żywo' : ''}`}
    >
      <View>
        <Image
          source={avatarUrl ? { uri: avatarUrl } : undefined}
          style={[styles.avatar, live && styles.avatarLive]}
          contentFit="cover"
          transition={150}
          placeholder={{ blurhash: 'L03[oj~qfQ~q~qfQfQfQfQfQfQfQ' }}
        />
        {live ? <View style={styles.liveDot} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {live ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          ) : null}
        </View>

        {live ? (
          <>
            <Text style={styles.streamTitle} numberOfLines={1}>
              {live.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[
                live.gameName,
                `${formatViewers(live.viewerCount)} widzów`,
                formatUptime(live.startedAt),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            {subtitle ?? `@${login}`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceHigh,
  },
  avatarLive: {
    borderWidth: 2,
    borderColor: colors.live,
  },
  liveDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.live,
    borderWidth: 2,
    borderColor: colors.background,
  },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  liveBadge: {
    backgroundColor: colors.live,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  streamTitle: { color: colors.text, fontSize: 13 },
  meta: { color: colors.textMuted, fontSize: 12 },
});
