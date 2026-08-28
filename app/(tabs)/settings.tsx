import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { TWITCH_REDIRECT_URI } from '../../src/auth/config';
import { colors, radius, spacing } from '../../src/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  function confirmSignOut() {
    Alert.alert('Wylogować?', 'Token zostanie usunięty z urządzenia i unieważniony.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyloguj',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const expiresLabel = user?.expiresAt
    ? new Date(user.expiresAt).toLocaleString('pl-PL')
    : 'nieznany';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {user ? (
        <View style={styles.profile}>
          <Image
            source={user.profileImageUrl ? { uri: user.profileImageUrl } : undefined}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.profileText}>
            <Text style={styles.displayName}>{user.displayName}</Text>
            <Text style={styles.login}>@{user.login}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sesja</Text>
        <Row label="Tryb OAuth" value="implicit grant" />
        <Row label="Redirect URI" value={TWITCH_REDIRECT_URI} />
        <Row label="Zakresy" value={user?.scopes.join(', ') || '—'} />
        <Row label="Token wygasa" value={expiresLabel} />
        <Row label="Odświeżanie" value="brak — po wygaśnięciu ponowne logowanie" />
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        onPress={confirmSignOut}
        disabled={busy}
      >
        <Text style={styles.signOutLabel}>Wyloguj się</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceHigh },
  profileText: { gap: 2 },
  displayName: { color: colors.text, fontSize: 20, fontWeight: '700' },
  login: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  signOut: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutPressed: { backgroundColor: 'rgba(245,81,95,0.12)' },
  signOutLabel: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
