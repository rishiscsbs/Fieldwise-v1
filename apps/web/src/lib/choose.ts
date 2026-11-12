import { useActiveFarm } from './farm';
import { useFmt } from './format';
import { useUpdateFarm } from './queries';
import { burst } from './effects';
import { toast } from '../stores/toast';
import type { ReferenceDto } from './api-types';

/** "Grow this": sets the farm's crop optimistically and celebrates with a seed burst. */
export function useChooseCrop(ref: ReferenceDto | undefined) {
  const { t, label } = useFmt();
  const { farm } = useActiveFarm();
  const update = useUpdateFarm(farm?.id ?? '');
  return (cropId: string, from?: Element | null) => {
    if (!farm) return;
    update.mutate({ crop: cropId });
    void burst(from);
    toast({
      tone: 'good',
      title: t('planner.picked', { crop: label(ref?.crops.find((c) => c.id === cropId)?.n) }),
    });
  };
}
