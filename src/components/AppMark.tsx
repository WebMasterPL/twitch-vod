import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  size?: number;
  /** Podpis obok znaku. Pomijany, gdy tylko sam symbol. */
  showWordmark?: boolean;
};

/**
 * Znak aplikacji: trojkat odtwarzania na fioletowym kaflu.
 *
 * Ten sam motyw co ikona aplikacji (assets/icon.svg), ale bez pierscienia -
 * przy malych rozmiarach w interfejsie pierscien zlewa sie w plame.
 * Trojkat rysowany obramowaniami, zeby nie ciagnac react-native-svg.
 */
export function AppMark({ size = 72, showWordmark = false }: Props) {
  const tile = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
  };

  // Klasyczna sztuczka: trojkat z obramowan elementu o zerowych wymiarach.
  const half = Math.round(size * 0.2);
  const triangle = {
    borderTopWidth: half,
    borderBottomWidth: half,
    borderLeftWidth: Math.round(size * 0.32),
    marginLeft: Math.round(size * 0.08),
  };

  return (
    <View style={styles.row}>
      <View style={[styles.tile, tile]}>
        <View style={[styles.triangle, triangle]} />
      </View>
      {showWordmark ? (
        <View>
          <Text style={styles.wordmark}>Twitch</Text>
          <Text style={styles.wordmarkAccent}>VOD</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tile: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
    borderStyle: 'solid',
  },
  wordmark: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  wordmarkAccent: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: 30,
  },
});
