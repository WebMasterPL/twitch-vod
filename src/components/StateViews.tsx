import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeError } from '../api/errors';
import { colors, radius, spacing } from '../theme';

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} size="large" />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Coś poszło nie tak</Text>
      <Text style={styles.muted}>{describeError(error)}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
        >
          <Text style={styles.buttonLabel}>Spróbuj ponownie</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  buttonPressed: { backgroundColor: colors.accentPressed },
  buttonLabel: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
