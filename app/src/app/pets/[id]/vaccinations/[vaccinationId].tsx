import { router, useLocalSearchParams } from 'expo-router';
import { Banner, Button, Screen } from '../../../../components/ui';
import { VaccinationForm } from '../../../../components/VaccinationForm';
import { confirm } from '../../../../lib/confirm';
import { useDeleteVaccination, usePet, useSaveVaccination } from '../../../../lib/queries';

export default function EditVaccination() {
  const { id, vaccinationId } = useLocalSearchParams<{ id: string; vaccinationId: string }>();
  const { pet } = usePet(id);
  const vaccination = pet?.vaccinations.find((v) => v.id === vaccinationId);
  const save = useSaveVaccination(id, vaccinationId);
  const remove = useDeleteVaccination(id);

  if (!vaccination) {
    return (
      <Screen>
        <Banner tone="error">Vaccination not found.</Banner>
      </Screen>
    );
  }

  return (
    <Screen>
      <VaccinationForm
        species={pet?.species ?? 'Dog'}
        vaccination={vaccination}
        saving={save.isPending}
        error={save.error}
        onSubmit={(input) => save.mutate(input, { onSuccess: () => router.back() })}
      />
      {remove.error ? <Banner tone="error">{remove.error.message}</Banner> : null}
      <Button
        title="Delete vaccination"
        kind="danger"
        busy={remove.isPending}
        onPress={async () => {
          if (await confirm('Delete vaccination?', `${vaccination.type} will be removed from ${pet?.name}'s records.`)) {
            remove.mutate(vaccination.id, { onSuccess: () => router.back() });
          }
        }}
      />
    </Screen>
  );
}
