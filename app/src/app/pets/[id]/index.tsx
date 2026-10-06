import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { PetPhoto } from '../../../components/PetPhoto';
import { Badge, Banner, Body, Button, Card, Heading, Loading, Screen, SectionLabel } from '../../../components/ui';
import { confirm } from '../../../lib/confirm';
import { formatDate } from '../../../lib/format';
import { pickPhoto } from '../../../lib/photo';
import { useDeletePet, usePet, useRemovePhoto, useSetPhoto } from '../../../lib/queries';
import { localToday, overallStatus, photoReminder, statusFor, upcoming } from '../../../lib/status';
import { fonts, useColors } from '../../../theme';

export default function PetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { pet, isPending } = usePet(id);
  const setPhoto = useSetPhoto(id);
  const removePhoto = useRemovePhoto(id);
  const deletePet = useDeletePet();
  const today = localToday();

  if (!pet) {
    return isPending ? (
      <Loading />
    ) : (
      <Screen>
        <Banner tone="error">Pet not found.</Banner>
      </Screen>
    );
  }

  const reminder = photoReminder(pet, today);
  const soon = upcoming(pet);
  const history = pet.vaccinations; // newest first, from the API

  async function changePhoto(source: 'library' | 'camera') {
    const uri = await pickPhoto(source);
    if (uri) setPhoto.mutate(uri);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: pet.name }} />

      <View style={styles.header}>
        <Pressable onPress={() => changePhoto('library')} accessibilityRole="button" accessibilityLabel="Change photo">
          <PetPhoto pet={pet} size={120} />
        </Pressable>
        <Heading>{pet.name}</Heading>
        <Body muted>
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ''}
          {pet.dob ? ` · Born ${formatDate(pet.dob)}` : ''}
        </Body>
        <Badge status={overallStatus(pet, today)} />
      </View>

      <Card>
        <Text style={[styles.label, { color: colors.mossDark }]}>Microchip number</Text>
        <Text style={[styles.chip, { color: colors.ink }]} selectable>
          {pet.chip ?? 'Not recorded'}
        </Text>
        {pet.weightKg != null ? (
          <>
            <Text style={[styles.label, { color: colors.mossDark }]}>Weight</Text>
            <Text style={[styles.itemTitle, { color: colors.ink }]}>{pet.weightKg} kg</Text>
          </>
        ) : null}
      </Card>

      {reminder ? <Banner tone="warn">{reminder.message}</Banner> : null}
      {setPhoto.error ? <Banner tone="error">{setPhoto.error.message}</Banner> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            title={pet.photoUrl ? 'Change photo' : 'Add photo'}
            kind="secondary"
            busy={setPhoto.isPending}
            onPress={() => changePhoto('library')}
          />
        </View>
        {Platform.OS !== 'web' ? (
          <View style={styles.flex}>
            <Button title="Take photo" kind="secondary" disabled={setPhoto.isPending} onPress={() => changePhoto('camera')} />
          </View>
        ) : null}
      </View>

      <SectionLabel>Coming up</SectionLabel>
      {soon.length === 0 ? (
        <Body muted>No expiry dates recorded.</Body>
      ) : (
        soon.map((v) => (
          <View key={v.id} style={[styles.item, { borderColor: colors.line }]}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, { color: colors.ink }]}>{v.type}</Text>
              <Body muted>Due {formatDate(v.expires)}</Body>
            </View>
            <Badge status={statusFor(v, today)} />
          </View>
        ))
      )}

      <SectionLabel>Vaccination history</SectionLabel>
      {history.length === 0 ? <Body muted>No vaccinations recorded yet.</Body> : null}
      {history.map((v) => (
        <Card key={v.id} onPress={() => router.push(`/pets/${pet.id}/vaccinations/${v.id}`)}>
          <View style={styles.rowCenter}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, { color: colors.ink }]}>{v.type}</Text>
              <Body muted>
                Given {formatDate(v.given)}
                {v.validFrom ? ` · valid from ${formatDate(v.validFrom)}` : ''}
                {v.vet ? ` · ${v.vet}` : ''}
                {v.expires ? ` · expires ${formatDate(v.expires)}` : ''}
              </Body>
              {v.manufacturer || v.lotNumber ? (
                <Body muted>
                  {[v.manufacturer, v.lotNumber ? `Lot ${v.lotNumber}` : null].filter(Boolean).join(' · ')}
                </Body>
              ) : null}
            </View>
            <Badge status={statusFor(v, today)} />
          </View>
        </Card>
      ))}
      <Button title="Add vaccination" onPress={() => router.push(`/pets/${pet.id}/vaccinations/new`)} />

      <SectionLabel>Manage</SectionLabel>
      <Button title="Edit details" kind="secondary" onPress={() => router.push(`/pets/${pet.id}/edit`)} />
      {pet.photoUrl ? (
        <Button
          title="Remove photo"
          kind="secondary"
          busy={removePhoto.isPending}
          onPress={async () => {
            if (await confirm('Remove photo?', `${pet.name}'s photo will be deleted.`, 'Remove')) removePhoto.mutate();
          }}
        />
      ) : null}
      {deletePet.error ? <Banner tone="error">{deletePet.error.message}</Banner> : null}
      <Button
        title="Delete pet"
        kind="danger"
        busy={deletePet.isPending}
        onPress={async () => {
          if (await confirm(`Delete ${pet.name}?`, 'All of their vaccination records and photos will be deleted.')) {
            deletePet.mutate(pet.id, { onSuccess: () => router.replace('/') });
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, marginBottom: 4 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13 },
  chip: { fontFamily: fonts.sansSemiBold, fontSize: 22, letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, paddingVertical: 8 },
  itemTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
});
