import { useFarms } from './queries';
import { useUi } from '../stores/ui';

/** The field the farmer is looking at: the one picked in the switcher, or their first. */
export function useActiveFarm() {
  const farms = useFarms();
  const picked = useUi((s) => s.farmId);
  const farm = farms.data?.find((f) => f.id === picked) ?? farms.data?.[0];
  return {
    farm,
    farms: farms.data ?? [],
    isLoading: farms.isLoading,
    error: farms.error,
    refetch: farms.refetch,
  };
}
