// Response shapes for every API route. The API validates and serialises with these; the web app infers its types from them.
import { z } from 'zod';
import { Role, SeasonEnum } from './index.js';

// Extra languages are optional so this matches the Labels type, where a missing language falls back to English.
export const LabelsSchema = z.object({ en: z.string() }).catchall(z.string().optional());
const Id = z.string();
const IsoDate = z.string();

// ---------- reference ----------

export const CropSchema = z.object({
  id: Id,
  e: z.string(),
  n: LabelsSchema,
  s: z.array(z.string()),
  soil: z.array(z.string()),
  ph: z.array(z.number()),
  w: z.array(z.number()),
  t: z.array(z.number()),
  npk: z.array(z.number()),
  kc: z.number(),
  d: z.string(),
  y: z.number(),
  msp: z.number().nullable(),
  p: z.number(),
  leg: z.number(),
});

export const PestSchema = z.object({
  id: Id,
  n: LabelsSchema,
  c: z.array(z.string()),
  s: z.array(z.string()),
  o: LabelsSchema,
  ch: LabelsSchema,
  pv: LabelsSchema,
});

export const DistrictDto = z.object({
  id: Id,
  labels: LabelsSchema,
  lat: z.number(),
  lon: z.number(),
  soil: z.string(),
  ph: z.number(),
  rainMm: z.number(),
  temp: z.object({ kharif: z.number(), rabi: z.number(), zaid: z.number() }),
  markets: z.array(z.string()),
});

export const ReferenceDto = z.object({
  crops: z.array(CropSchema),
  pests: z.array(PestSchema),
  districts: z.array(DistrictDto),
  soils: z.array(z.object({ id: Id, labels: LabelsSchema, taw: z.number() })),
  seasons: z.array(z.object({ id: SeasonEnum, labels: LabelsSchema })),
  irrigation: z.array(z.object({ id: Id, labels: LabelsSchema, mm: z.number() })),
  symptoms: z.array(z.object({ id: Id, labels: LabelsSchema })),
  fertilisers: z.array(
    z.object({ id: Id, labels: LabelsSchema, bagKg: z.number(), cost: z.number(), colour: z.string() }),
  ),
});
export type ReferenceDto = z.infer<typeof ReferenceDto>;

// ---------- farms ----------

export const NutrientLevelEnum = z.enum(['low', 'med', 'high']);

export const SoilTestDto = z.object({
  id: Id,
  testedAt: IsoDate,
  ph: z.number(),
  n: z.number(),
  p: z.number(),
  k: z.number(),
  source: z.string(),
  levels: z.object({ n: NutrientLevelEnum, p: NutrientLevelEnum, k: NutrientLevelEnum }),
});
export type SoilTestDto = z.infer<typeof SoilTestDto>;

export const FarmDto = z.object({
  id: Id,
  name: z.string(),
  districtId: Id,
  village: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  soil: z.string(),
  irrigation: z.string(),
  areaAcres: z.number(),
  season: SeasonEnum,
  crop: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  latestSoilTest: SoilTestDto.nullable(),
});
export type FarmDto = z.infer<typeof FarmDto>;

export const FarmDetailDto = FarmDto.extend({ soilTests: z.array(SoilTestDto) });
export type FarmDetailDto = z.infer<typeof FarmDetailDto>;

// ---------- advisory ----------

export const ReasonDto = z.object({
  ok: z.boolean(),
  key: z.string(),
  args: z.record(z.union([z.string(), z.number(), LabelsSchema])).optional(),
});
export type ReasonDto = z.infer<typeof ReasonDto>;

/** Advice was computed from district defaults because the farm has no Soil Health Card yet. */
const UsingDefaults = z.boolean();

export const RecommendationsDto = z.object({
  farmId: Id,
  season: SeasonEnum,
  water: z.number(),
  temp: z.number(),
  usingDefaults: UsingDefaults,
  activeCrop: Id,
  list: z.array(z.object({ cropId: Id, score: z.number(), reasons: z.array(ReasonDto) })),
  out: z.array(Id),
});
export type RecommendationsDto = z.infer<typeof RecommendationsDto>;

const Npk = z.array(z.number()).length(3);
const Products = z.object({ urea: z.number(), dap: z.number(), mop: z.number() });

export const FertiliserDto = z.object({
  farmId: Id,
  cropId: Id,
  areaAcres: z.number(),
  usingDefaults: UsingDefaults,
  levels: z.array(NutrientLevelEnum),
  recommendedPerHa: Npk,
  adjustedPerHa: Npk,
  perField: Npk,
  kg: Products,
  bags: Products,
  cost: z.number(),
  schedule: z.array(ReasonDto),
});
export type FertiliserDto = z.infer<typeof FertiliserDto>;

export const ForecastDayDto = z.object({
  date: z.string(),
  tmax: z.number(),
  tmin: z.number(),
  rp: z.number(),
  rain: z.number(),
  hum: z.number(),
  wind: z.number(),
});
export type ForecastDayDto = z.infer<typeof ForecastDayDto>;

export const ForecastDto = z.object({
  districtId: Id,
  /** open-meteo = live; simulated = fallback generator */
  source: z.enum(['open-meteo', 'simulated']),
  simulated: z.boolean(),
  fetchedAt: IsoDate,
  days: z.array(ForecastDayDto),
});
export type ForecastDto = z.infer<typeof ForecastDto>;

export const WaterDto = z.object({
  farmId: Id,
  cropId: Id,
  forecast: ForecastDto,
  thresholdMm: z.number(),
  days: z.array(
    z.object({ et0: z.number(), etc: z.number(), def: z.number(), irr: z.number(), spray: z.boolean() }),
  ),
  nextIrrigation: z.object({ date: z.string(), mm: z.number() }).nullable(),
  sprayDays: z.array(z.string()),
  fungalRisk: z.boolean(),
});
export type WaterDto = z.infer<typeof WaterDto>;

export const MandiSourceDto = z.object({
  id: z.enum(['simulated', 'agmarknet']),
  simulated: z.boolean(),
  /** Days of history the source provides */
  historyDays: z.number(),
});

export const MandiDto = z.object({
  districtId: Id,
  cropId: Id,
  source: MandiSourceDto,
  fetchedAt: IsoDate,
  msp: z.number().nullable(),
  markets: z.array(
    z.object({
      market: z.string(),
      today: z.number(),
      /** 7-day change, %; null when the source has no history */
      change: z.number().nullable(),
      series: z.array(z.number()),
      date: z.string().nullable(),
    }),
  ),
  advice: z
    .object({
      key: z.enum(['rising', 'falling', 'stable', 'belowMsp']),
      bestMarket: z.string(),
      bestPrice: z.number(),
      avgChange: z.number(),
    })
    .nullable(),
});
export type MandiDto = z.infer<typeof MandiDto>;

// ---------- crop health ----------

export const DiagnoseInput = z.object({
  crop: Id,
  symptoms: z.array(z.string()).min(1, 'Pick at least one sign').max(12),
  /** When given, a confident match is logged as a pest report for the officer heatmap */
  farmId: z.string().optional(),
});

export const PestMatchDto = z.object({ pestId: Id, score: z.number() });

export const UploadDto = z.object({ id: Id, url: z.string(), mime: z.string(), size: z.number() });
export type UploadDto = z.infer<typeof UploadDto>;

export const LeafRegionDto = z.object({
  /** Normalised 0–1 box */
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  kind: z.enum(['yellow', 'brown', 'white']),
});

export const HealthCheckDto = z.object({
  id: Id,
  crop: Id,
  analyser: z.object({ id: z.string(), version: z.string(), isModel: z.boolean() }),
  colours: z.object({ green: z.number(), yellow: z.number(), brown: z.number(), white: z.number() }),
  findings: z.array(z.string()),
  symptoms: z.array(z.string()),
  regions: z.array(LeafRegionDto),
  matches: z.array(PestMatchDto),
  upload: UploadDto,
  createdAt: IsoDate,
});
export type HealthCheckDto = z.infer<typeof HealthCheckDto>;

// ---------- desk ----------

export const TicketStatusEnum = z.enum(['open', 'answered', 'closed']);
export const TicketCategoryEnum = z.enum(['pest', 'disease', 'nutrient', 'water', 'market', 'other']);
const Person = z.object({ id: Id, name: z.string() });

export const TicketDto = z.object({
  id: Id,
  subject: z.string(),
  status: TicketStatusEnum,
  category: TicketCategoryEnum,
  crop: z.string().nullable(),
  districtId: Id,
  farmId: z.string().nullable(),
  farmer: Person,
  officer: Person.nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  messageCount: z.number(),
});
export type TicketDto = z.infer<typeof TicketDto>;

export const TicketMessageDto = z.object({
  id: Id,
  ticketId: Id,
  author: Person.extend({ role: Role }),
  body: z.string(),
  createdAt: IsoDate,
  attachments: z.array(UploadDto),
});
export type TicketMessageDto = z.infer<typeof TicketMessageDto>;

export const TicketDetailDto = TicketDto.extend({ messages: z.array(TicketMessageDto) });
export type TicketDetailDto = z.infer<typeof TicketDetailDto>;

export const TicketInput = z.object({
  body: z.string().trim().min(5, 'Write at least a few words').max(2000),
  crop: z.string().nullable().optional(),
  farmId: z.string().nullable().optional(),
  category: TicketCategoryEnum.default('other'),
  uploadIds: z.array(z.string()).max(4).default([]),
});

export const MessageInput = z.object({
  body: z.string().trim().min(1, 'Write a message').max(2000),
  uploadIds: z.array(z.string()).max(4).default([]),
});

// ---------- alerts and notifications ----------

export const AlertLevelEnum = z.enum(['info', 'warn', 'bad']);

export const AlertDto = z.object({
  id: Id,
  level: AlertLevelEnum,
  labels: LabelsSchema,
  districtId: z.string().nullable(),
  cropId: z.string().nullable(),
  author: Person,
  createdAt: IsoDate,
});
export type AlertDto = z.infer<typeof AlertDto>;

export const AlertInput = z.object({
  labels: z.object({ en: z.string().trim().min(5).max(500) }).catchall(z.string().trim().max(500)),
  level: AlertLevelEnum.default('warn'),
  /** Officers may only target their own district; admins may send to every district with null */
  districtId: z.string().nullable().optional(),
  cropId: z.string().nullable().optional(),
});

export const NotificationTypeEnum = z.enum(['alert', 'ticket_new', 'ticket_reply', 'ticket_status']);

export const NotificationDto = z.object({
  id: Id,
  type: NotificationTypeEnum,
  refId: z.string().nullable(),
  title: LabelsSchema,
  readAt: IsoDate.nullable(),
  createdAt: IsoDate,
});
export type NotificationDto = z.infer<typeof NotificationDto>;

export const NotificationListDto = z.object({ unread: z.number(), items: z.array(NotificationDto) });

// ---------- realtime events (Socket.IO) ----------

export interface ServerToClientEvents {
  'alert:new': (alert: AlertDto) => void;
  'notification:new': (n: NotificationDto) => void;
  'ticket:new': (t: TicketDto) => void;
  'ticket:updated': (t: TicketDto) => void;
  'ticket:message': (m: TicketMessageDto) => void;
}
