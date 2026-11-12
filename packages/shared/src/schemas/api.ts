// Response shapes for every API route. The API validates and serialises with these; the web app infers its types from them.
import { z } from 'zod';
import { Phone, Role, SeasonEnum } from './index.js';

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
export type NotificationListDto = z.infer<typeof NotificationListDto>;

// ---------- realtime events (Socket.IO) ----------

export interface ServerToClientEvents {
  'alert:new': (alert: AlertDto) => void;
  'notification:new': (n: NotificationDto) => void;
  'ticket:new': (t: TicketDto) => void;
  'ticket:updated': (t: TicketDto) => void;
  'ticket:message': (m: TicketMessageDto) => void;
}

// ---------- officer dashboard ----------

export const OfficerSummaryDto = z.object({
  districtId: Id,
  days: z.number(),
  farmers: z.number(),
  farms: z.number(),
  areaAcres: z.number(),
  tickets: z.object({ open: z.number(), answered: z.number(), closed: z.number() }),
  /** Median hours from question to first officer reply, over answered questions in the window */
  medianResponseHours: z.number().nullable(),
  /** Hours the oldest open question has waited */
  oldestOpenHours: z.number().nullable(),
  pestReports: z.number(),
  alertsSent: z.number(),
  categories: z.array(z.object({ category: TicketCategoryEnum, count: z.number() })),
  weekly: z.array(z.object({ weekStart: z.string(), opened: z.number(), answered: z.number() })),
  topPests: z.array(z.object({ pestId: Id, count: z.number() })),
  crops: z.array(z.object({ cropId: Id, farms: z.number() })),
});
export type OfficerSummaryDto = z.infer<typeof OfficerSummaryDto>;

export const OfficerMapDto = z.object({
  district: z.object({ id: Id, labels: LabelsSchema, lat: z.number(), lon: z.number() }),
  farms: z.array(
    z.object({
      id: Id,
      name: z.string(),
      farmer: z.string(),
      lat: z.number(),
      lon: z.number(),
      crop: z.string().nullable(),
      areaAcres: z.number(),
      openTickets: z.number(),
    }),
  ),
  tickets: z.array(
    z.object({
      id: Id,
      subject: z.string(),
      category: TicketCategoryEnum,
      farmer: z.string(),
      lat: z.number(),
      lon: z.number(),
      createdAt: IsoDate,
    }),
  ),
});
export type OfficerMapDto = z.infer<typeof OfficerMapDto>;

export const PestPointsDto = z.object({
  districtId: Id,
  days: z.number(),
  reports: z.array(
    z.object({ pestId: Id, lat: z.number(), lon: z.number(), reportedAt: IsoDate, source: z.string() }),
  ),
});
export type PestPointsDto = z.infer<typeof PestPointsDto>;

// ---------- admin ----------

export const AdminOverviewDto = z.object({
  users: z.object({ farmer: z.number(), officer: z.number(), admin: z.number() }),
  districts: z.array(
    z.object({
      id: Id,
      labels: LabelsSchema,
      lat: z.number(),
      lon: z.number(),
      active: z.boolean(),
      farmers: z.number(),
      farms: z.number(),
      openTickets: z.number(),
      pestReports: z.number(),
      officers: z.number(),
    }),
  ),
});
export type AdminOverviewDto = z.infer<typeof AdminOverviewDto>;

export const AdminUserDto = z.object({
  id: Id,
  phone: z.string(),
  name: z.string(),
  role: Role,
  districtId: z.string().nullable(),
  lang: z.string(),
  active: z.boolean(),
  farms: z.number(),
  createdAt: IsoDate,
});
export type AdminUserDto = z.infer<typeof AdminUserDto>;

export const AdminUserCreate = z.object({
  phone: Phone,
  name: z.string().trim().min(1).max(80),
  role: Role,
  districtId: z.string().nullable(),
});

export const AdminUserPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: Role.optional(),
  districtId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const AdminDistrictDto = z.object({
  id: Id,
  labels: LabelsSchema,
  lat: z.number(),
  lon: z.number(),
  rainMm: z.number(),
  temp: z.object({ kharif: z.number(), rabi: z.number(), zaid: z.number() }),
  soil: z.string(),
  ph: z.number(),
  active: z.boolean(),
  markets: z.array(z.string()),
});
export type AdminDistrictDto = z.infer<typeof AdminDistrictDto>;

export const AdminDistrictPatch = z.object({
  labels: z
    .object({ en: z.string().trim().min(1) })
    .catchall(z.string())
    .optional(),
  rainMm: z.number().min(0).max(12000).optional(),
  temp: z
    .object({
      kharif: z.number().min(-10).max(50),
      rabi: z.number().min(-10).max(50),
      zaid: z.number().min(-10).max(50),
    })
    .partial()
    .optional(),
  soil: z.string().optional(),
  ph: z.number().min(3).max(11).optional(),
  active: z.boolean().optional(),
  markets: z.array(z.string().trim().min(1).max(60)).min(1).max(12).optional(),
});

export const AdminCropDto = CropSchema.extend({ active: z.boolean() });
export type AdminCropDto = z.infer<typeof AdminCropDto>;

/** Editable crop reference values. Ranges are [min, max]. */
export const AdminCropPatch = z.object({
  e: z.string().max(8).optional(),
  n: z
    .object({ en: z.string().trim().min(1) })
    .catchall(z.string())
    .optional(),
  s: z.array(SeasonEnum).min(1).optional(),
  soil: z.array(z.string()).min(1).optional(),
  ph: z.tuple([z.number().min(3), z.number().max(11)]).optional(),
  w: z.tuple([z.number().min(0), z.number().max(5000)]).optional(),
  t: z.tuple([z.number().min(-10), z.number().max(50)]).optional(),
  npk: z.tuple([z.number().min(0), z.number().min(0), z.number().min(0)]).optional(),
  kc: z.number().min(0.1).max(2).optional(),
  d: z.string().max(20).optional(),
  y: z.number().min(0).max(2000).optional(),
  msp: z.number().min(0).nullable().optional(),
  p: z.number().min(0).optional(),
  leg: z.union([z.literal(0), z.literal(1)]).optional(),
  active: z.boolean().optional(),
});
export const AdminCropCreate = AdminCropPatch.required({
  e: true,
  n: true,
  s: true,
  soil: true,
  ph: true,
  w: true,
  t: true,
  npk: true,
  kc: true,
  d: true,
  y: true,
  p: true,
  leg: true,
}).extend({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, 'Use lowercase letters, numbers and dashes'),
});
