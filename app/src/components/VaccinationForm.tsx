import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, fieldError } from '../lib/api';
import { isIsoDate, localTodayIso } from '../lib/format';
import type { Vaccination, VaccinationInput } from '../lib/types';
import { fonts, useColors } from '../theme';
import { Banner, Button, Field } from './ui';

/** Common UK vaccinations, from the prototype's suggestions list. */
const SUGGESTIONS = ['Rabies', 'DHPP (Distemper/Parvo)', 'Leptospirosis', 'Kennel cough (Bordetella)', 'Booster'];

export function VaccinationForm({
  vaccination,
  saving,
  error,
  onSubmit,
}: {
  vaccination?: Vaccination;
  saving: boolean;
  error: unknown;
  onSubmit: (input: VaccinationInput) => void;
}) {
  const colors = useColors();
  const [type, setType] = useState(vaccination?.type ?? '');
  const [vet, setVet] = useState(vaccination?.vet ?? '');
  const [given, setGiven] = useState(vaccination?.given ?? localTodayIso());
  const [expires, setExpires] = useState(vaccination?.expires ?? '');
  const [touched, setTouched] = useState(false);

  const local = {
    type: type.trim() ? undefined : 'Vaccine is required',
    given: isIsoDate(given) ? undefined : 'Use the format YYYY-MM-DD',
    expires:
      expires && !isIsoDate(expires)
        ? 'Use the format YYYY-MM-DD'
        : expires && expires < given
          ? 'Expiry must be on or after the date given'
          : undefined,
  };
  const valid = !local.type && !local.given && !local.expires;
  const show = (field: keyof typeof local) => (touched ? local[field] : undefined) ?? fieldError(error, field);

  return (
    <>
      {error instanceof ApiError && !error.details ? <Banner tone="error">{error.message}</Banner> : null}
      <Field label="Vaccine" value={type} onChangeText={setType} error={show('type')} placeholder="e.g. Rabies" />
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => setType(s)}
            style={[styles.chip, { borderColor: colors.line, backgroundColor: s === type ? colors.sand : colors.card }]}
          >
            <Text style={[styles.chipText, { color: colors.ink }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Vet / clinic" value={vet} onChangeText={setVet} placeholder="Optional" autoCapitalize="words" />
      <Field
        label="Date given"
        value={given}
        onChangeText={setGiven}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        error={show('given')}
      />
      <Field
        label="Expires / due"
        value={expires}
        onChangeText={setExpires}
        placeholder="YYYY-MM-DD (optional)"
        keyboardType="numbers-and-punctuation"
        error={show('expires')}
      />
      <Button
        title={vaccination ? 'Save changes' : 'Add vaccination'}
        busy={saving}
        onPress={() => {
          setTouched(true);
          if (valid) onSubmit({ type: type.trim(), vet, given, expires });
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
