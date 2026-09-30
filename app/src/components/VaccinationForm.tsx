import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, fieldError } from '../lib/api';
import { localTodayIso } from '../lib/format';
import type { Species, Vaccination, VaccinationInput } from '../lib/types';
import { fonts, useColors } from '../theme';
import { DateField } from './fields';
import { Banner, Button, Field } from './ui';

/** Common UK vaccines per species, offered as one-tap suggestions. */
const VACCINES: Record<Species, string[]> = {
  Dog: ['Rabies', 'DHP', 'DHPPi', 'Leptospirosis (L4)', 'Kennel cough', 'Booster'],
  Cat: ['Rabies', 'Cat flu & enteritis', 'FeLV (feline leukaemia)', 'Booster'],
  Rabbit: ['Myxomatosis & RHD', 'RHD2', 'Booster'],
  Other: ['Rabies', 'Booster'],
};

/** Vaccine brands commonly seen on UK pet passport stickers. */
const MANUFACTURERS = ['Nobivac', 'Versican Plus', 'Canigen', 'Eurican', 'Rabisin', 'Purevax'];

function Suggestions({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  const colors = useColors();
  return (
    <View style={styles.suggestions}>
      {options.map((s) => (
        <Pressable
          key={s}
          onPress={() => onPick(s)}
          style={[styles.chip, { borderColor: colors.line, backgroundColor: s === value ? colors.sand : colors.card }]}
        >
          <Text style={[styles.chipText, { color: colors.ink }]}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function VaccinationForm({
  species,
  vaccination,
  saving,
  error,
  onSubmit,
}: {
  species: Species;
  vaccination?: Vaccination;
  saving: boolean;
  error: unknown;
  onSubmit: (input: VaccinationInput) => void;
}) {
  const [type, setType] = useState(vaccination?.type ?? '');
  const [manufacturer, setManufacturer] = useState(vaccination?.manufacturer ?? '');
  const [lotNumber, setLotNumber] = useState(vaccination?.lotNumber ?? '');
  const [vet, setVet] = useState(vaccination?.vet ?? '');
  const initialGiven = vaccination?.given ?? localTodayIso();
  const [given, setGiven] = useState<string | null>(initialGiven);
  const [expires, setExpires] = useState<string | null>(vaccination?.expires ?? '');
  const [touched, setTouched] = useState(false);

  const local = {
    type: type.trim() ? undefined : 'Vaccine is required',
    given: given ? undefined : 'Enter a real date as DD-MM-YYYY',
    expires:
      expires === null
        ? 'Enter a real date as DD-MM-YYYY'
        : expires && given && expires < given
          ? 'Expiry must be on or after the date given'
          : undefined,
  };
  const valid = !local.type && !local.given && !local.expires;
  const show = (field: keyof typeof local) => (touched ? local[field] : undefined) ?? fieldError(error, field);

  return (
    <>
      {error instanceof ApiError && !error.details ? <Banner tone="error">{error.message}</Banner> : null}
      <Field label="Vaccine" value={type} onChangeText={setType} error={show('type')} placeholder="e.g. Rabies" />
      <Suggestions options={VACCINES[species]} value={type} onPick={setType} />
      <Field
        label="Manufacturer / brand"
        value={manufacturer}
        onChangeText={setManufacturer}
        placeholder="Optional, e.g. Nobivac"
        autoCapitalize="words"
        error={fieldError(error, 'manufacturer')}
      />
      <Suggestions options={MANUFACTURERS} value={manufacturer} onPick={setManufacturer} />
      <Field
        label="Lot / batch number"
        value={lotNumber}
        onChangeText={setLotNumber}
        placeholder="Optional, from the vaccine sticker"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
        error={fieldError(error, 'lotNumber')}
      />
      <Field label="Vet / clinic" value={vet} onChangeText={setVet} placeholder="Optional" autoCapitalize="words" />
      <DateField label="Date given" initialIso={initialGiven} onChange={setGiven} error={show('given')} />
      <DateField label="Expires / due" initialIso={vaccination?.expires} onChange={setExpires} optional error={show('expires')} />
      <Button
        title={vaccination ? 'Save changes' : 'Add vaccination'}
        busy={saving}
        onPress={() => {
          setTouched(true);
          if (valid && given) {
            onSubmit({ type: type.trim(), manufacturer, lotNumber, vet, given, expires: expires ?? '' });
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fonts.sans, fontSize: 12 },
});
