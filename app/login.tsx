import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { TWITCH_REDIRECT_URI, configProblems } from '../src/auth/config';
import { AuthCancelled } from '../src/auth/twitchAuth';
import { colors, radius, spacing } from '../src/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = configProblems();

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      // Zamkniecie okna przez uzytkownika to nie awaria.
      if (!(err instanceof AuthCancelled)) {
        setError(err instanceof Error ? err.message : 'Logowanie nie powiodło się');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.logo}>Twitch VOD</Text>
      <Text style={styles.subtitle}>
        Odtwarzacz archiwalnych transmisji z Twoich śledzonych kanałów.
      </Text>

      {problems.length > 0 ? (
        <View style={styles.problems}>
          <Text style={styles.problemsTitle}>Brakuje konfiguracji</Text>
          {problems.map((problem) => (
            <Text key={problem} style={styles.problemsItem}>
              • {problem}
            </Text>
          ))}
          <Text style={styles.problemsHint}>
            Uzupełnij plik .env i przebuduj aplikację (patrz README).
          </Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (busy || problems.length > 0) && styles.buttonDisabled,
        ]}
        onPress={handleSignIn}
        disabled={busy || problems.length > 0}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonLabel}>Zaloguj się przez Twitcha</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Tryb OAuth: implicit grant</Text>
        <Text style={styles.footerText}>Redirect URI: {TWITCH_REDIRECT_URI}</Text>
        <Text style={styles.footerText}>Zakres uprawnień: user:read:follows</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  logo: { color: colors.text, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonPressed: { backgroundColor: colors.accentPressed },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  problems: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  problemsTitle: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  problemsItem: { color: colors.textMuted, fontSize: 13 },
  problemsHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  footer: { marginTop: spacing.xl, gap: 2 },
  footerText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
