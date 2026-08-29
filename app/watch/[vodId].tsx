import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { getVideoById } from '../../src/api/helix';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, formatDuration, formatViewers } from '../../src/lib/format';
import { markLoginHintSeen, shouldShowLoginHint } from '../../src/lib/playerHints';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Twitch wymaga, aby parametr `parent` odpowiadał domenie, z której
 * osadzany jest odtwarzacz. W React Native nie ma prawdziwego origin,
 * więc ustawiamy własny `baseUrl` w WebView i tę samą domenę podajemy
 * jako `parent`. Zmień na domenę, którą kontrolujesz.
 */
const EMBED_DOMAIN = 'twitch.tv';
const EMBED_BASE_URL = `https://${EMBED_DOMAIN}`;

function buildPlayerHtml(videoId: string): string {
  const src =
    `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}` +
    `&parent=${EMBED_DOMAIN}&autoplay=true&muted=false`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; }
      iframe { border: 0; width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <iframe
      src="${src}"
      allowfullscreen
      allow="autoplay; fullscreen; picture-in-picture"
    ></iframe>
  </body>
</html>`;
}

export default function WatchScreen() {
  const { vodId } = useLocalSearchParams<{ vodId: string }>();
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerFailed, setPlayerFailed] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void shouldShowLoginHint().then((show) => {
      if (!cancelled) setShowLoginHint(show);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismissLoginHint() {
    setShowLoginHint(false);
    void markLoginHintSeen();
  }

  const vod = useAsync((signal) => getVideoById(vodId, signal), [vodId], Boolean(vodId));

  const video = vod.data;

  const playerHtml = useMemo(
    () => (video ? buildPlayerHtml(video.id) : null),
    [video],
  );

  if (vod.loading) return <LoadingState label="Wczytuję VOD…" />;
  if (vod.error) return <ErrorState error={vod.error} onRetry={vod.reload} />;
  if (!video) return <ErrorState error={new Error('Nie znaleziono VOD-a')} />;

  const metaLine = [
    video.userName,
    formatDate(video.publishedAt || video.createdAt),
    formatDuration(video.durationSeconds),
    `${formatViewers(video.viewCount)} wyświetleń`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: video.userName }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        scrollEnabled={!playerLoading}
      >
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={3}>
            {video.title || 'Bez tytułu'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>

        <View style={styles.playerBox}>
          {playerHtml && !playerFailed ? (
            <>
              <WebView
                source={{ html: playerHtml, baseUrl: EMBED_BASE_URL }}
                style={styles.player}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                allowsAirPlayForMediaPlayback
                allowsPictureInPictureMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                onLoadEnd={() => setPlayerLoading(false)}
                onError={() => {
                  setPlayerLoading(false);
                  setPlayerFailed(true);
                }}
                onHttpError={() => {
                  setPlayerLoading(false);
                  setPlayerFailed(true);
                }}
              />
              {playerLoading ? (
                <View style={styles.playerOverlay} pointerEvents="none">
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.playerOverlay}>
              <Text style={styles.playerFallback}>
                {playerHtml
                  ? 'Nie udało się wczytać odtwarzacza.'
                  : 'Brak adresu odtwarzacza — sprawdź konfigurację.'}
              </Text>
            </View>
          )}
        </View>

        {showLoginHint ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Odtwarzacz ma własną sesję Twitcha. Jeśli VOD wymaga subskrypcji,
              zaloguj się na Twitcha w oknie odtwarzacza — wystarczy raz.
            </Text>
            <Pressable
              onPress={dismissLoginHint}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ukryj podpowiedź"
            >
              <Text style={styles.hintDismiss}>Rozumiem</Text>
            </Pressable>
          </View>
        ) : null}

        {video.description ? (
          <Text style={styles.description}>{video.description}</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  playerBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: colors.border,
  },
  player: { flex: 1, backgroundColor: '#000000' },
  playerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  playerFallback: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  hint: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  hintText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  hintDismiss: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  description: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
