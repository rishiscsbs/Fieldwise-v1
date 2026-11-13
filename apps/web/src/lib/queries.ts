// TanStack Query hooks for every API resource. Keys are centralised in `qk` so sockets and mutations
// can invalidate exactly what changed.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminCropDto,
  AdminDistrictDto,
  AdminOverviewDto,
  AdminUserDto,
  AlertDto,
  AuthSession,
  FarmDetailDto,
  FarmDto,
  FarmInput,
  FertiliserDto,
  HealthCheckDto,
  MandiDto,
  RecommendationsDto,
  ReferenceDto,
  SoilTestDto,
  TicketDetailDto,
  TicketDto,
  TicketMessageDto,
  UploadDto,
  NotificationListDto,
  OfficerMapDto,
  OfficerSummaryDto,
  PestPointsDto,
  WaterDto,
} from './api-types';
import { api } from './api';
import { useAuth } from '../stores/auth';

export const qk = {
  reference: ['reference'] as const,
  farms: ['farms'] as const,
  farm: (id: string) => ['farm', id] as const,
  advice: (id: string) => ['advice', id] as const,
  recs: (id: string) => ['advice', id, 'recs'] as const,
  fert: (id: string, crop?: string) => ['advice', id, 'fert', crop ?? ''] as const,
  water: (id: string, crop?: string) => ['advice', id, 'water', crop ?? ''] as const,
  mandi: (id: string, crop?: string) => ['advice', id, 'mandi', crop ?? ''] as const,
  tickets: ['tickets'] as const,
  ticket: (id: string) => ['ticket', id] as const,
  alerts: ['alerts'] as const,
  notifications: ['notifications'] as const,
  checks: ['health-checks'] as const,
};

const MIN = 60_000;

// Query options shared by the hooks below and by the warm start (lib/warm.ts), so both fetch the same way.
export const referenceQuery = {
  queryKey: qk.reference,
  queryFn: () => api<ReferenceDto>('/reference'),
  staleTime: 30 * MIN,
};
export const farmsQuery = { queryKey: qk.farms, queryFn: () => api<FarmDto[]>('/farms') };
export const recsQuery = (id: string) => ({
  queryKey: qk.recs(id),
  queryFn: () => api<RecommendationsDto>(`/farms/${id}/recommendations`),
});

export const useReference = () => useQuery(referenceQuery);

export const useFarms = () => useQuery(farmsQuery);

export const useFarm = (id: string | undefined) =>
  useQuery({ queryKey: qk.farm(id ?? ''), queryFn: () => api<FarmDetailDto>(`/farms/${id}`), enabled: !!id });

const q = (crop?: string) => (crop ? `?crop=${encodeURIComponent(crop)}` : '');

export const useRecommendations = (id: string | undefined) =>
  useQuery({ ...recsQuery(id ?? ''), enabled: !!id });

export const fertQuery = (id: string, crop?: string) => ({
  queryKey: qk.fert(id, crop),
  queryFn: () => api<FertiliserDto>(`/farms/${id}/fertiliser${q(crop)}`),
});
export const waterQuery = (id: string, crop?: string) => ({
  queryKey: qk.water(id, crop),
  queryFn: () => api<WaterDto>(`/farms/${id}/water${q(crop)}`),
  staleTime: 10 * MIN,
});
export const mandiQuery = (id: string, crop?: string) => ({
  queryKey: qk.mandi(id, crop),
  queryFn: () => api<MandiDto>(`/farms/${id}/mandi${q(crop)}`),
  staleTime: 10 * MIN,
});

export const useFertiliser = (id: string | undefined, crop?: string) =>
  useQuery({ ...fertQuery(id ?? '', crop), enabled: !!id, placeholderData: keepPreviousData });

export const useWater = (id: string | undefined, crop?: string) =>
  useQuery({ ...waterQuery(id ?? '', crop), enabled: !!id });

export const useMandi = (id: string | undefined, crop?: string) =>
  useQuery({ ...mandiQuery(id ?? '', crop), enabled: !!id, placeholderData: keepPreviousData });

export const useTickets = () =>
  useQuery({ queryKey: qk.tickets, queryFn: () => api<TicketDto[]>('/tickets') });

export const useTicket = (id: string | undefined) =>
  useQuery({
    queryKey: qk.ticket(id ?? ''),
    queryFn: () => api<TicketDetailDto>(`/tickets/${id}`),
    enabled: !!id,
  });

export const useAlerts = () => useQuery({ queryKey: qk.alerts, queryFn: () => api<AlertDto[]>('/alerts') });

export const useNotifications = () =>
  useQuery({
    queryKey: qk.notifications,
    queryFn: () => api<NotificationListDto>('/notifications'),
  });

// ---------- mutations ----------

/** Updates a farm. Picking a crop is optimistic: the farm list shows it before the server answers. */
export function useUpdateFarm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FarmInput>) => api<FarmDto>(`/farms/${id}`, { method: 'PATCH', body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.farms });
      const prev = qc.getQueryData<FarmDto[]>(qk.farms);
      qc.setQueryData<FarmDto[]>(qk.farms, (list) => list?.map((f) => (f.id === id ? { ...f, ...body } : f)));
      return { prev };
    },
    onError: (_e, _b, ctx) => ctx?.prev && qc.setQueryData(qk.farms, ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.farms });
      void qc.invalidateQueries({ queryKey: qk.farm(id) });
      void qc.invalidateQueries({ queryKey: qk.advice(id) });
    },
  });
}

export function useCreateFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      body: FarmInput & { soilTest?: { testedAt: string; ph: number; n: number; p: number; k: number } },
    ) => api<FarmDetailDto>('/farms', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.farms }),
  });
}

export function useDeleteFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/farms/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.farms }),
  });
}

export function useAddSoilTest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      testedAt: string;
      ph: number;
      n: number;
      p: number;
      k: number;
      source: 'shc' | 'self';
    }) => api<SoilTestDto>(`/farms/${id}/soil-tests`, { body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.farms });
      void qc.invalidateQueries({ queryKey: qk.farm(id) });
      void qc.invalidateQueries({ queryKey: qk.advice(id) });
    },
  });
}

export const useDiagnose = () =>
  useMutation({
    mutationFn: (body: { crop: string; symptoms: string[]; farmId?: string }) =>
      api<{ matches: { pestId: string; score: number }[] }>('/diagnose', { body }),
  });

export function useAnalyseLeaf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, crop, farmId }: { file: Blob; crop: string; farmId?: string }) => {
      const fd = new FormData();
      fd.append('file', file, 'leaf.jpg');
      const qs = new URLSearchParams({ crop, ...(farmId ? { farmId } : {}) });
      return api<HealthCheckDto>(`/health/analyse?${qs}`, { body: fd });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.checks }),
  });
}

export const useUpload = () =>
  useMutation({
    mutationFn: (file: Blob) => {
      const fd = new FormData();
      fd.append('file', file, 'photo.jpg');
      return api<UploadDto>('/uploads', { body: fd });
    },
  });

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      body: string;
      crop?: string | null;
      farmId?: string | null;
      category: string;
      uploadIds: string[];
    }) => api<TicketDetailDto>('/tickets', { body }),
    onSuccess: (t) => {
      qc.setQueryData<TicketDto[]>(qk.tickets, (list) => [t, ...(list ?? [])]);
      qc.setQueryData(qk.ticket(t.id), t);
    },
  });
}

/** Sends a reply, showing it in the thread straight away. */
export function useSendMessage(ticketId: string) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  return useMutation({
    mutationFn: (body: { body: string; uploadIds: string[] }) =>
      api<TicketMessageDto>(`/tickets/${ticketId}/messages`, { body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.ticket(ticketId) });
      const prev = qc.getQueryData<TicketDetailDto>(qk.ticket(ticketId));
      if (prev && user) {
        const temp: TicketMessageDto = {
          id: `temp-${Date.now()}`,
          ticketId,
          author: { id: user.id, name: user.name, role: user.role },
          body: body.body,
          createdAt: new Date().toISOString(),
          attachments: [],
        };
        qc.setQueryData<TicketDetailDto>(qk.ticket(ticketId), {
          ...prev,
          messages: [...prev.messages, temp],
        });
      }
      return { prev };
    },
    onError: (_e, _b, ctx) => ctx?.prev && qc.setQueryData(qk.ticket(ticketId), ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.ticket(ticketId) });
      void qc.invalidateQueries({ queryKey: qk.tickets });
    },
  });
}

export function useSetTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: TicketDto['status']) =>
      api<TicketDto>(`/tickets/${ticketId}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.ticket(ticketId) });
      void qc.invalidateQueries({ queryKey: qk.tickets });
    },
  });
}

export function useSendAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      labels: { en: string; hi?: string };
      level: AlertDto['level'];
      cropId?: string | null;
    }) => api<AlertDto>('/alerts', { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.alerts }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api<{ unread: number }>('/notifications/read', { body: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}

export function useUpdateMe() {
  return useMutation({
    mutationFn: (body: { name?: string; lang?: string; districtId?: string }) =>
      api<AuthSession>('/me', { method: 'PATCH', body }),
    onSuccess: (s) => useAuth.getState().setSession(s),
  });
}

// ---------- officer and admin ----------

const staffQs = (o: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') q.set(k, String(v));
  return q.toString() ? `?${q}` : '';
};

export const useOfficerSummary = (districtId: string | undefined, days: number) =>
  useQuery({
    queryKey: ['officer', 'summary', districtId ?? '', days],
    queryFn: () => api<OfficerSummaryDto>(`/officer/summary${staffQs({ districtId, days })}`),
    placeholderData: keepPreviousData,
  });

export const useOfficerMap = (districtId: string | undefined) =>
  useQuery({
    queryKey: ['officer', 'map', districtId ?? ''],
    queryFn: () => api<OfficerMapDto>(`/officer/map${staffQs({ districtId })}`),
    placeholderData: keepPreviousData,
  });

export const usePestPoints = (districtId: string | undefined, days: number, pestId?: string) =>
  useQuery({
    queryKey: ['officer', 'pests', districtId ?? '', days, pestId ?? ''],
    queryFn: () => api<PestPointsDto>(`/officer/pests${staffQs({ districtId, days, pestId })}`),
    placeholderData: keepPreviousData,
  });

export const useAdminOverview = () =>
  useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<AdminOverviewDto>('/admin/overview') });

export const useAdminUsers = (f: { role?: string; districtId?: string; q?: string }) =>
  useQuery({
    queryKey: ['admin', 'users', f],
    queryFn: () => api<AdminUserDto[]>(`/admin/users${staffQs(f)}`),
    placeholderData: keepPreviousData,
  });

export const useAdminDistricts = () =>
  useQuery({ queryKey: ['admin', 'districts'], queryFn: () => api<AdminDistrictDto[]>('/admin/districts') });

export const useAdminCrops = () =>
  useQuery({ queryKey: ['admin', 'crops'], queryFn: () => api<AdminCropDto[]>('/admin/crops') });

/** Admin writes refresh admin lists and the shared reference data. */
export function useAdminMutation<B, R>(
  path: (b: B) => string,
  method: 'POST' | 'PATCH',
  body: (b: B) => object,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: B) => api<R>(path(b), { method, body: body(b) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: qk.reference });
    },
  });
}
