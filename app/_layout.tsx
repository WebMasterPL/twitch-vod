import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { LoadingState } from '../src/components/StateViews';
import { colors } from '../src/theme';

/** Przekierowuje miedzy ekranem logowania a aplikacja w zaleznosci od sesji. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const onLoginScreen = segments[0] === 'login';

    if (status === 'signedOut' && !onLoginScreen) {
      router.replace('/login');
    } else if (status === 'signedIn' && onLoginScreen) {
      router.replace('/');
    }
  }, [status, segments, router]);

  if (status === 'loading') {
    return <LoadingState label="Sprawdzam sesję…" />;
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTitleStyle: { color: colors.text },
                headerTintColor: colors.accent,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="channel/[id]" options={{ title: 'VOD-y' }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
