import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CognitoUser } from 'amazon-cognito-identity-js';
import * as auth from './auth';
import { hydrateTokenStorage } from './tokenStorage';

interface AuthState {
  ready: boolean;
  email: string | null;
  /** Set between a temporary-password sign-in and choosing a new password. */
  pendingChallenge: { user: CognitoUser; email: string } | null;
  signIn(email: string, password: string): Promise<'signed-in' | 'new-password-required'>;
  completeNewPassword(newPassword: string): Promise<void>;
  signOut(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<AuthState['pendingChallenge']>(null);

  useEffect(() => {
    hydrateTokenStorage().then(() => {
      setEmail(auth.currentEmail());
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (address: string, password: string) => {
    const result = await auth.signIn(address, password);
    if (result.status === 'new-password-required') {
      setPendingChallenge({ user: result.user, email: address });
      return 'new-password-required' as const;
    }
    setEmail(auth.currentEmail());
    return 'signed-in' as const;
  }, []);

  const completeNewPassword = useCallback(
    async (newPassword: string) => {
      if (!pendingChallenge) throw new Error('No sign-in in progress');
      await auth.completeNewPassword(pendingChallenge.user, pendingChallenge.email, newPassword);
      setPendingChallenge(null);
      setEmail(auth.currentEmail());
    },
    [pendingChallenge],
  );

  const signOut = useCallback(() => {
    auth.signOut();
    setEmail(null);
    onSignOut();
  }, [onSignOut]);

  const value = useMemo(
    () => ({ ready, email, pendingChallenge, signIn, completeNewPassword, signOut }),
    [ready, email, pendingChallenge, signIn, completeNewPassword, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
