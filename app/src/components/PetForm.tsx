import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ApiError, fieldError } from '../lib/api';
import { localTodayIso } from '../lib/format';
import { pickPhoto } from '../lib/photo';
import { SPECIES, type Pet, type PetSave, type Species } from '../lib/types';
import { fonts, useColors } from '../theme';
import { DateField } from './fields';
import { PetPhoto } from './PetPhoto';
import { Banner, Button, Choice, Field } from './ui';

export function PetForm({
  pet,
  saving,
  error,
  onSubmit,
}: {
  pet?: Pet;
  saving: boolean;
  error: unknown;
  onSubmit: (result: PetSave) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'Dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [dob, setDob] = useState<string | null>(pet?.dob ?? '');
  const [chip, setChip] = useState(pet?.chip ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const local = {
    name: name.trim() ? undefined : 'Pet name is required',
    dob: dob === null ? 'Enter a real date as DD-MM-YYYY' : dob && dob > localTodayIso() ? "Date of birth can't be in the future" : undefined,
    chip: chip && !/^\d{15}$/.test(chip) ? 'Microchip number must be 15 digits' : undefined,
  };
  const valid = !local.name && !local.dob && !local.chip;
  const show = (field: keyof typeof local) => (touched ? local[field] : undefined) ?? fieldError(error, field);

  async function choose(source: 'library' | 'camera') {
    const uri = await pickPhoto(source);
    if (uri) setPhotoUri(uri);
  }

  return (
    <>
      {error instanceof ApiError && !error.details ? <Banner tone="error">{error.message}</Banner> : null}

      <View style={styles.photo}>
        <Pressable onPress={() => choose('library')} accessibilityRole="button" accessibilityLabel="Choose a photo">
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={[styles.preview, { backgroundColor: colors.sand }]} contentFit="cover" />
          ) : (
            <PetPhoto pet={{ id: pet?.id ?? 'new', name: name || '?', photoUrl: pet?.photoUrl ?? null, photoUpdatedAt: pet?.photoUpdatedAt ?? null }} size={96} />
          )}
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable onPress={() => choose('library')} hitSlop={6}>
            <Text style={[styles.link, { color: colors.moss }]}>
              {photoUri || pet?.photoUrl ? 'Change photo' : 'Add photo'}
            </Text>
          </Pressable>
          {Platform.OS !== 'web' ? (
            <Pressable onPress={() => choose('camera')} hitSlop={6}>
              <Text style={[styles.link, { color: colors.moss }]}>Take photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Field label="Pet name" value={name} onChangeText={setName} error={show('name')} autoCapitalize="words" />
      <Choice label="Species" options={SPECIES} value={species} onChange={setSpecies} />
      <Field label="Breed" value={breed} onChangeText={setBreed} placeholder="Optional" autoCapitalize="words" />
      <DateField
        label="Date of birth"
        initialIso={pet?.dob}
        onChange={setDob}
        optional
        error={show('dob')}
        hint="Used for photo reminders as they grow."
      />
      <Field
        label="Microchip number"
        value={chip}
        onChangeText={(v) => setChip(v.replace(/\D/g, ''))}
        placeholder="e.g. 933012400146699"
        keyboardType="number-pad"
        maxLength={15}
        error={show('chip')}
      />
      <Button
        title={pet ? 'Save changes' : 'Add pet'}
        busy={saving}
        onPress={() => {
          setTouched(true);
          if (valid) onSubmit({ input: { name: name.trim(), species, breed, dob: dob ?? '', chip }, photoUri });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', gap: 8 },
  preview: { width: 96, height: 96, borderRadius: 48 },
  photoActions: { flexDirection: 'row', gap: 20 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
});
