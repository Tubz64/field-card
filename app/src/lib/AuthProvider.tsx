import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CognitoUser } from 'amazon-cognito-identity-js';
import { api } from './api';
import * as auth from './auth';
import { hydrateTokenStorage } from './tokenStorage';

interface AuthState {
  ready: boolean;
  /** Null when signed out. */
  profile: auth.Profile | null;
  /** Set between a temporary-password sign-in and choosing a new password. */
  pendingChallenge: { user: CognitoUser } | null;
  signIn(email: string, password: string): Promise<'signed-in' | 'new-password-required'>;
  completeNewPassword(newPassword: string): Promise<void>;
  updateName(givenName: string, familyName: string): Promise<void>;
  /** Deletes the account and all its data on the server, then signs out locally. */
  deleteAccount(): Promise<void>;
  signOut(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<auth.Profile | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<AuthState['pendingChallenge']>(null);

  useEffect(() => {
    hydrateTokenStorage().then(() => {
      setProfile(auth.currentProfile());
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await auth.signIn(email, password);
    if (result.status === 'new-password-required') {
      setPendingChallenge({ user: result.user });
      return 'new-password-required' as const;
    }
    setProfile(auth.currentProfile());
    return 'signed-in' as const;
  }, []);

  const completeNewPassword = useCallback(
    async (newPassword: string) => {
      if (!pendingChallenge) throw new Error('No sign-in in progress');
      await auth.completeNewPassword(pendingChallenge.user, newPassword);
      setPendingChallenge(null);
      setProfile(auth.currentProfile());
    },
    [pendingChallenge],
  );

  const updateName = useCallback(async (givenName: string, familyName: string) => {
    await auth.updateName(givenName, familyName);
    setProfile(auth.currentProfile());
  }, []);

  const signOut = useCallback(() => {
    auth.signOut();
    setProfile(null);
    onSignOut();
  }, [onSignOut]);

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount();
    signOut();
  }, [signOut]);

  const value = useMemo(
    () => ({ ready, profile, pendingChallenge, signIn, completeNewPassword, updateName, deleteAccount, signOut }),
    [ready, profile, pendingChallenge, signIn, completeNewPassword, updateName, deleteAccount, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
