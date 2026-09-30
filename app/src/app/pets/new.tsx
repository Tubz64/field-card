import { router } from 'expo-router';
import { PetForm } from '../../components/PetForm';
import { Screen } from '../../components/ui';
import { notify } from '../../lib/confirm';
import { useSavePet } from '../../lib/queries';

export default function NewPet() {
  const save = useSavePet();
  return (
    <Screen>
      <PetForm
        saving={save.isPending}
        error={save.error}
        onSubmit={(result) =>
          save.mutate(result, {
            onSuccess: ({ pet, photoError }) => {
              router.replace(`/pets/${pet.id}`);
              if (photoError) notify(`${pet.name} was added`, `But the photo didn't upload: ${photoError.message}`);
            },
          })
        }
      />
    </Screen>
  );
}
