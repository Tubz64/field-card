import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../components/ui';
import { VaccinationForm } from '../../../../components/VaccinationForm';
import { usePet, useSaveVaccination } from '../../../../lib/queries';

export default function NewVaccination() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pet } = usePet(id);
  const save = useSaveVaccination(id);
  return (
    <Screen>
      <VaccinationForm
        species={pet?.species ?? 'Dog'}
        saving={save.isPending}
        error={save.error}
        onSubmit={(input) => save.mutate(input, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
