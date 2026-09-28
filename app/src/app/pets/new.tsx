import { router } from 'expo-router';
import { PetForm } from '../../components/PetForm';
import { Screen } from '../../components/ui';
import { useSavePet } from '../../lib/queries';

export default function NewPet() {
  const save = useSavePet();
  return (
    <Screen>
      <PetForm
        saving={save.isPending}
        error={save.error}
        onSubmit={(input) => save.mutate(input, { onSuccess: (pet) => router.replace(`/pets/${pet.id}`) })}
      />
    </Screen>
  );
}
