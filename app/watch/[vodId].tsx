import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getVideoById } from '../../src/api/helix';
import { playerUrlForVod } from '../../src/auth/config';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, formatDuration, formatViewers } from '../../src/lib/format';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Odtwarzacz oparty na oficjalnym embedzie Twitcha w WKWebView.
 *
 * gql.twitch.tv odrzuca nasz Client-Id, wiec playback access token jest poza
 * zasiegiem i usher odpada. Embed jest jedyna droga, ktora nie wymaga
 * podszywania sie pod klienta webowego Twitcha.
 *
 * Sesja Twitcha w tym WebView jest odrebna od Safari - iOS izoluje
 * WKWebsiteDataStore per aplikacja. Uzytkownik loguje sie tu raz, a sesja
 * zostaje w magazynie aplikacji. VOD-y sub-only dziala wylacznie dzieki
 * uprawnieniom tego konta; nic tego nie omija.
 */
export default function WatchScreen() {
  const { vodId } = useLocalSearchParams<{ vodId: string }>();
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerFailed, setPlayerFailed] = useState(false);

  const vod = useAsync((signal) => getVideoById(vodId, signal), [vodId], Boolean(vodId));

  if (vod.loading) return <LoadingState label="Wczytuję VOD…" />;
  if (vod.error) return <ErrorState error={vod.error} onRetry={vod.reload} />;
  if (!vod.data) return <ErrorState error={new Error('Nie znaleziono VOD-a')} />;

  const video = vod.data;
  const playerUrl = playerUrlForVod(video.id);

  return (
    <>
      <Stack.Screen options={{ title: video.userName }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        // Gesty odtwarzacza nie moga konkurowac z przewijaniem ekranu.
        scrollEnabled={!playerLoading}
      >
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={3}>
            {video.title || 'Bez tytułu'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[
              video.userName,
              formatDate(video.publishedAt || video.createdAt),
              formatDuration(video.durationSeconds),
              `${formatViewers(video.viewCount)} wyświetleń`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        <View style={styles.playerBox}>
          {playerUrl && !playerFailed ? (
            <>
              <WebView
                source={{ uri: playerUrl }}
                style={styles.player}
                // Bez tego iOS przejmuje ekran natywnym odtwarzaczem od razu
                // po starcie, zamiast grac w ramce.
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
                {playerUrl
                  ? 'Nie udało się wczytać odtwarzacza.'
                  : 'Brak adresu odtwarzacza — sprawdź konfigurację.'}
              </Text>
            </View>
          )}
        </View>

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
  description: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
