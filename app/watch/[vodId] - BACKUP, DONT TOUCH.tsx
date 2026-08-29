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
 * Skrypt JS wstrzykiwany przed załadowaniem strony Twitcha.
 * Działa na zasadzie podmiany Client-ID oraz ukrywania elementów DOM oznaczonych jako "sub-only".
 */
const TWITCHNOSUB_SCRIPT = `
(function() {
  console.log('[TwitchNoSub] Inicjalizacja...');

  // --- 1. PODMIANA CLIENT-ID ---
  // Zapisujemy oryginalną metodę XMLHttpRequest
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
    // Jeśli nagłówek to Client-ID, podmieniamy go na publiczny
    if (key.toLowerCase() === 'client-id') {
      // To ID pozwala na odtwarzanie VOD-ów bez konieczności bycia subskrybentem 
      // (z pewnymi ograniczeniami, np. brak niektórych funkcji społecznościowych).
      value = 'kimne79xkrwz66ojhe3v0t249i3m9'; 
      console.log('[TwitchNoSub] Client-ID zmieniony na publiczny.');
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  // --- 2. CSS: UKRYWANIE ELEMENTÓW SUB-ONLY ---
  // Dodajemy styl, który wymusza display: none na elementach z danymi sub-only
  const style = document.createElement('style');
  style.innerHTML = \`
    /* Ukryj kontenery VOD/Clips oznaczone jako sub-only */
    .vod-card__sub-only,
    .clip-card__sub-only,
    .stream-card__sub-only,
    [data-sub-only="true"],
    [data-audio-only="true"],
    .video-player__sub-only-overlay {
      display: none !important;
    }
    
    /* Ukryj przycisk "Sub Required" */
    .sub-required-button {
      display: none !important;
    }
  \`;
  document.head.appendChild(style);

  // --- 3. MUTATION OBSERVER ---
  // Obserwator, który ukrywa nowe elementy sub-only dodane dynamicznie (lazy loading)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element DOM
          // Sprawdź sam element
          if (node.dataset.subOnly === 'true' || 
              node.dataset.audioOnly === 'true' ||
              node.classList.contains('sub-only')) {
            node.style.display = 'none';
          }
          
          // Sprawdź dzieci (jeśli dodany node zawiera ukrywalne elementy)
          const subOnlyElements = node.querySelectorAll('[data-sub-only="true"], [data-audio-only="true"], .sub-only');
          subOnlyElements.forEach(el => el.style.display = 'none');
        }
      });
    });
  });

  // Zacznij obserwować body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[TwitchNoSub] Gotowe.');
})();
true; 
`;

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
        // Gesty odtwarzacza nie mogą konkurować z przewijaniem ekranu.
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
                // po starcie, zamiast grać w ramce.
                allowsInlineMediaPlayback
                allowsAirPlayForMediaPlayback
                allowsPictureInPictureMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                
                // <-- KLUCZOWA ZMIANA: WSTRZYKIWANIE SKRYPTU TWITCHNOSUB
                injectedJavaScriptBeforeContentLoaded={TWITCHNOSUB_SCRIPT}
                
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