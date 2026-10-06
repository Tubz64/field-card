import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { syncReminders } from '../lib/notifications';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PetPhoto } from '../components/PetPhoto';
import { Badge, Banner, Body, Button, Card, Loading, Screen } from '../components/ui';
import { useAuth } from '../lib/AuthProvider';
import { formatAgo } from '../lib/format';
import { usePets } from '../lib/queries';
import { localToday, overallStatus } from '../lib/status';
import { fonts, useColors } from '../theme';

export default function PetList() {
  const { profile } = useAuth();
  const colors = useColors();
  const { data: pets, error, isPending, isRefetching, refetch, dataUpdatedAt } = usePets();
  const today = localToday();

  // Keep expiry reminders in step with the records whenever they change.
  useEffect(() => {
    if (pets) void syncReminders(pets).catch((err) => console.warn('Could not schedule reminders', err));
  }, [pets]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/profile')} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.moss, fontFamily: fonts.sansMedium }}>Profile</Text>
            </Pressable>
          ),
        }}
      />
      {isPending && !pets ? (
        <Loading />
      ) : (
        <Screen refreshing={isRefetching} onRefresh={refetch}>
          {/* Accounts created before names were collected fall back to the email. */}
          <Body muted>Signed in as {profile?.givenName || profile?.email}</Body>
          {error && pets ? (
            <Banner tone="warn">Offline. Showing records saved {formatAgo(dataUpdatedAt)}.</Banner>
          ) : error ? (
            <Banner tone="error">{error.message}</Banner>
          ) : null}

          {pets?.length === 0 ? (
            <Card>
              <Body>No pets yet. Add one to keep their vaccination records to hand.</Body>
            </Card>
          ) : null}

          {pets?.map((pet) => (
            <Card key={pet.id} onPress={() => router.push(`/pets/${pet.id}`)}>
              <View style={styles.row}>
                <PetPhoto pet={pet} size={56} />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.ink }]}>{pet.name}</Text>
                  <Body muted>
                    {pet.species}
                    {pet.breed ? ` · ${pet.breed}` : ''}
                  </Body>
                  <Badge status={overallStatus(pet, today)} />
                </View>
              </View>
            </Card>
          ))}

          <Button title="Add a pet" onPress={() => router.push('/pets/new')} />
        </Screen>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.serifBold, fontSize: 20 },
});
