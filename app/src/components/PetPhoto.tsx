import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { Pet } from '../lib/types';
import { fonts, useColors } from '../theme';

/**
 * The presigned photoUrl changes every hour, so cache by pet + upload time
 * instead: the image stays on disk and shows offline until the photo changes.
 */
export function PetPhoto({ pet, size }: { pet: Pick<Pet, 'id' | 'name' | 'photoUrl' | 'photoUpdatedAt'>; size: number }) {
  const colors = useColors();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (!pet.photoUrl || !pet.photoUpdatedAt) {
    return (
      <View style={[styles.initial, round, { backgroundColor: colors.sand }]}>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: size * 0.42, color: colors.mossDark }}>
          {(pet.name || '?').slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: pet.photoUrl, cacheKey: `pet-${pet.id}-${pet.photoUpdatedAt}` }}
      cachePolicy="disk"
      style={[round, { backgroundColor: colors.sand }]}
      contentFit="cover"
      transition={150}
      accessibilityLabel={`Photo of ${pet.name}`}
    />
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
});
