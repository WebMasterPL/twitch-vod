import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as authManager from './authManager';
import type { AuthState } from './authManager';
import type { StoredSession } from './tokenStore';

type AuthContextValue = AuthState & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  user: StoredSession | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => authManager.getState());

  useEffect(() => {
    const unsubscribe = authManager.subscribe(setState);
    void authManager.bootstrap();
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      user: state.session,
      signIn: authManager.signIn,
      signOut: authManager.signOut,
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth musi byc uzyte wewnatrz <AuthProvider>');
  }
  return value;
}
