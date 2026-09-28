import { useState } from 'react';
import { ApiError, fieldError } from '../lib/api';
import { isIsoDate } from '../lib/format';
import { SPECIES, type Pet, type PetInput, type Species } from '../lib/types';
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
  onSubmit: (input: PetInput) => void;
}) {
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'Dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [dob, setDob] = useState(pet?.dob ?? '');
  const [chip, setChip] = useState(pet?.chip ?? '');
  const [touched, setTouched] = useState(false);

  const local = {
    name: name.trim() ? undefined : 'Name is required',
    dob: dob && !isIsoDate(dob) ? 'Use the format YYYY-MM-DD' : undefined,
    chip: chip && !/^\d{15}$/.test(chip) ? 'Microchip number must be 15 digits' : undefined,
  };
  const valid = !local.name && !local.dob && !local.chip;
  const show = (field: keyof typeof local) => (touched ? local[field] : undefined) ?? fieldError(error, field);

  return (
    <>
      {error instanceof ApiError && !error.details ? <Banner tone="error">{error.message}</Banner> : null}
      <Field label="Name" value={name} onChangeText={setName} error={show('name')} autoCapitalize="words" />
      <Choice label="Species" options={SPECIES} value={species} onChange={setSpecies} />
      <Field label="Breed" value={breed} onChangeText={setBreed} placeholder="Optional" autoCapitalize="words" />
      <Field
        label="Date of birth"
        value={dob}
        onChangeText={setDob}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
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
          if (valid) onSubmit({ name: name.trim(), species, breed, dob, chip });
        }}
      />
    </>
  );
}
