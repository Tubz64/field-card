import { router, useLocalSearchParams } from 'expo-router';
import { PetForm } from '../../../components/PetForm';
import { Banner, Screen } from '../../../components/ui';
import { usePet, useSavePet } from '../../../lib/queries';

export default function EditPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pet } = usePet(id);
  const save = useSavePet(id);
  return (
    <Screen>
      {pet ? (
        <PetForm
          pet={pet}
          saving={save.isPending}
          error={save.error}
          onSubmit={(input) => save.mutate(input, { onSuccess: () => router.back() })}
        />
      ) : (
        <Banner tone="error">Pet not found.</Banner>
      )}
    </Screen>
  );
}
