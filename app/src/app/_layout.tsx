// Must load before amazon-cognito-identity-js: SRP needs crypto.getRandomValues.
import 'react-native-get-random-values';
import { useCallback, useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SignedOutError } from '../lib/auth';
import { AuthProvider, useAuth } from '../lib/AuthProvider';
import { OFFLINE_MAX_AGE, persister, queryClient } from '../lib/queries';
import { fonts, useColors } from '../theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Signing out wipes the offline cache so the next user sees nothing of it.
  const clearCache = useCallback(() => {
    queryClient.clear();
    void persister.removeClient();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: OFFLINE_MAX_AGE, buster: 'v1' }}>
      <AuthProvider onSignOut={clearCache}>
        <Navigator fontsLoaded={fontsLoaded} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

function Navigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, profile, signOut } = useAuth();
  const colors = useColors();
  const loaded = ready && fontsLoaded;

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  // A revoked or expired refresh token surfaces as SignedOutError from any request.
  useEffect(() => {
    const onError = (error: unknown) => {
      if (error instanceof SignedOutError) signOut();
    };
    const unsubQueries = queryClient.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'error') onError(e.action.error);
    });
    const unsubMutations = queryClient.getMutationCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'error') onError(e.action.error);
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [signOut]);

  if (!loaded) return null;
  const signedIn = profile !== null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.moss,
          headerTitleStyle: { fontFamily: fonts.serifBold, color: colors.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: 'Pawpers' }} />
          <Stack.Screen name="pets/new" options={{ title: 'Add a pet', presentation: 'modal' }} />
          <Stack.Screen name="pets/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="pets/[id]/edit" options={{ title: 'Edit pet', presentation: 'modal' }} />
          <Stack.Screen name="pets/[id]/vaccinations/new" options={{ title: 'Add vaccination', presentation: 'modal' }} />
          <Stack.Screen
            name="pets/[id]/vaccinations/[vaccinationId]"
            options={{ title: 'Vaccination', presentation: 'modal' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
          <Stack.Screen name="new-password" options={{ title: 'Choose a password' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
