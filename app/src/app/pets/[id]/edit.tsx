import { router, useLocalSearchParams } from 'expo-router';
import { PetForm } from '../../../components/PetForm';
import { Banner, Screen } from '../../../components/ui';
import { notify } from '../../../lib/confirm';
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
          onSubmit={(result) =>
            save.mutate(result, {
              onSuccess: ({ photoError }) => {
                router.back();
                if (photoError) notify('Details saved', `But the photo didn't upload: ${photoError.message}`);
              },
            })
          }
        />
      ) : (
        <Banner tone="error">Pet not found.</Banner>
      )}
    </Screen>
  );
}
