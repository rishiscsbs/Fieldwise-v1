import { useActiveFarm } from './farm';
import { useFmt } from './format';
import { useUpdateFarm } from './queries';
import { burst, haptic } from './effects';
import { CROP_BURST } from './delight';
import { toast } from '../stores/toast';
import type { ReferenceDto } from './api-types';

/** "Grow this": sets the farm's crop optimistically and celebrates with a burst in the crop's own colours. */
export function useChooseCrop(ref: ReferenceDto | undefined) {
  const { t, label } = useFmt();
  const { farm } = useActiveFarm();
  const update = useUpdateFarm(farm?.id ?? '');
  return (cropId: string, from?: Element | null) => {
    if (!farm) return;
    update.mutate({ crop: cropId });
    void burst(from, CROP_BURST[cropId]);
    haptic([8, 40, 16]);
    toast({
      tone: 'good',
      title: t('planner.picked', { crop: label(ref?.crops.find((c) => c.id === cropId)?.n) }),
    });
  };
}
