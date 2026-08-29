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

// IMPORTY Z TWOJEGO PROJEKTU (zachowaj istniejące importy)
import { getVideoById } from '../../src/api/helix';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAsync } from '../../src/hooks/useAsync';
import { formatDate, formatDuration, formatViewers } from '../../src/lib/format';
import { markLoginHintSeen, shouldShowLoginHint } from '../../src/lib/playerHints';
import { colors, radius, spacing } from '../../src/theme';

/**
 * GŁÓWNA LOGIKA TWITCHNOSUB
 * 1. Dodaje style CSS do ukrywania nakładek.
 * 2. Tworzy MutationObserver, który obserwuje ciało dokumentu.
 * 3. Gdy nowy element pojawia się i ma klasę/atrubut sub-only -> usuwa go z DOM.
 * 4. Uruchamia się od razu i po załadowaniu.
 */
const TWITCHNOSUB_INJECTED_SCRIPT = `
(function() {
  // 1. Dodaj style CSS
  const style = document.createElement('style');
  style.textContent = \`
    /* Ukryj nakładki CSS */
    .sub-gating-overlay,
    .sub-gating-container,
    .video-player__sub-only-overlay,
    .player-controls__sub-only,
    .vod-card__sub-only,
    .stream-card__sub-only,
    .video-player__sub-required,
    .sub-required-button,
    .player-controls__sub-button,
    
    /* Ukryj kontenery z danymi sub-only */
    [data-sub-only="true"],
    [data-audio-only="true"],
    .sub-gated-content {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }
    
    /* Usuń puste kontenery */
    .sub-gating-container:empty {
      display: none;
    }
  \`;
  document.head.appendChild(style);

  // 2. Funkcja rekurencyjnego usuwania
  function hideSubContent() {
    // Znajdź wszystkie elementy, które powinny być ukryte
    const elements = document.querySelectorAll('[data-sub-only="true"], .sub-gating-overlay, .sub-gating-container, .video-player__sub-only-overlay');
    
    elements.forEach(el => {
      // Sprawdź, czy element nie jest już ukryty
      if (el.style.display !== 'none') {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      }
    });
  }

  // 3. MutationObserver - obserwuj dodawanie nowych elementów
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element DOM
          // Sprawdź, czy dodany węzeł ma atrybut sub-only
          if (node.dataset && node.dataset.subOnly === 'true') {
            node.style.display = 'none';
          }
          // Sprawdź dzieci węzła
          const children = node.querySelectorAll('[data-sub-only="true"]');
          children.forEach(child => child.style.display = 'none');
        }
      });
    });
    // Uruchom ukrywanie dla wszystkich nowych elementów
    hideSubContent();
  });

  // Rozpocznij obserwację całego body
  observer.observe(document.body, { childList: true, subtree: true });

  // 4. Pierwsze uruchomienie
  hideSubContent();

  // 5. Powtórzne skanowanie po 2 sekundach (na wypadek leniwego ładowania Twitcha)
  setTimeout(() => {
    hideSubContent();
    // Wyślij sygnał do React Native
    window.ReactNativeWebView.postMessage('TwitchNoSub Ready');
  }, 2000);

  true;
})();
`;

const EMBED_DOMAIN = 'localhost'; 

function buildPlayerHtml(videoId: string): string {
  // Parent musi pasować do hosta, ale Twitch często ignoruje to dla wideo publicznych.
  // Dla VOD sub-only, Twitch i tak wymaga logowania w WebView.
  const src =
    `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}` +
    `&parent=${EMBED_DOMAIN}&autoplay=1&muted=1`;

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
                source={{ html: playerHtml, baseUrl: `https://${EMBED_DOMAIN}` }}
                style={styles.player}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                allowsAirPlayForMediaPlayback
                allowsPictureInPictureMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                // TU JEST KLUCZOWE: injectedJavaScript
                injectedJavaScript={TWITCHNOSUB_INJECTED_SCRIPT}
                onLoadEnd={() => {
                  setPlayerLoading(false);
                }}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView Error:', nativeEvent);
                  setPlayerLoading(false);
                  setPlayerFailed(true);
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('HTTP Error:', nativeEvent);
                  setPlayerLoading(false);
                  setPlayerFailed(true);
                }}
                onMessage={(event) => {
                  const { data } = event.nativeEvent;
                  if (data === 'TwitchNoSub Ready') {
                    console.log('[React Native] Skrypt TwitchNoSub załadowany.');
                  }
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
                  : 'Brak adresu odtwarzacza.'}
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