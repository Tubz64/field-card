import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { suggestBreeds } from '../lib/breeds';
import type { Species } from '../lib/types';
import { fonts, useColors } from '../theme';
import { Field } from './ui';

/** Free-text breed with suggestions from the bundled breed list as you type. */
export function BreedField({
  species,
  value,
  onChange,
}: {
  species: Species;
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? suggestBreeds(species, value) : [];

  return (
    <View>
      <Field
        label="Breed"
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        // Delay so a tap on a suggestion lands before the list disappears.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={species === 'Other' ? 'Optional' : 'Optional, start typing for suggestions'}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {suggestions.length > 0 ? (
        <View style={[styles.list, { borderColor: colors.line, backgroundColor: colors.card }]}>
          {suggestions.map((breed) => (
            <Pressable
              key={breed}
              onPress={() => {
                onChange(breed);
                setFocused(false);
              }}
              style={({ pressed }) => [styles.item, { borderColor: colors.line, opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.text, { color: colors.ink }]}>{breed}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 6, marginTop: 4, overflow: 'hidden' },
  item: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { fontFamily: fonts.sans, fontSize: 15 },
});
