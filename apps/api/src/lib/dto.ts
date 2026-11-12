// Database rows → API response objects.
import type {
  Alert,
  Farm,
  Notification,
  SoilTest,
  Ticket,
  TicketMessage,
  Upload,
  User,
} from '@prisma/client';
import {
  AlertLevelEnum,
  NotificationTypeEnum,
  Role,
  SeasonEnum,
  TicketCategoryEnum,
  TicketStatusEnum,
  lvlK,
  lvlN,
  lvlP,
  type AlertDto,
  type FarmDto,
  type NotificationDto,
  type SoilTestDto,
  type TicketDto,
  type TicketMessageDto,
} from '@fieldwise/shared';
import { uploadDto } from '../services/uploads.js';
import { parseLabels } from './json.js';

export const soilTestDto = (s: SoilTest): SoilTestDto => ({
  id: s.id,
  testedAt: s.testedAt.toISOString(),
  ph: s.ph,
  n: s.n,
  p: s.p,
  k: s.k,
  source: s.source,
  levels: { n: lvlN(s.n), p: lvlP(s.p), k: lvlK(s.k) },
});

export const farmDto = (f: Farm, latest: SoilTest | null | undefined): FarmDto => ({
  id: f.id,
  name: f.name,
  districtId: f.districtId,
  village: f.village,
  lat: f.lat,
  lon: f.lon,
  soil: f.soil,
  irrigation: f.irrigation,
  areaAcres: f.areaAcres,
  season: SeasonEnum.parse(f.season),
  crop: f.crop,
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
  latestSoilTest: latest ? soilTestDto(latest) : null,
});

const person = (u: Pick<User, 'id' | 'name'>) => ({ id: u.id, name: u.name || '—' });

export type TicketRow = Ticket & {
  farmer: Pick<User, 'id' | 'name'>;
  officer: Pick<User, 'id' | 'name'> | null;
  _count: { messages: number };
};

/** Prisma include for TicketRow */
export const ticketInclude = {
  farmer: { select: { id: true, name: true } },
  officer: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} as const;

export const ticketDto = (t: TicketRow): TicketDto => ({
  id: t.id,
  subject: t.subject,
  status: TicketStatusEnum.parse(t.status),
  category: TicketCategoryEnum.catch('other').parse(t.category),
  crop: t.crop,
  districtId: t.districtId,
  farmId: t.farmId,
  farmer: person(t.farmer),
  officer: t.officer ? person(t.officer) : null,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  messageCount: t._count.messages,
});

export type MessageRow = TicketMessage & {
  author: Pick<User, 'id' | 'name' | 'role'>;
  attachments: { upload: Upload }[];
};

export const messageInclude = {
  author: { select: { id: true, name: true, role: true } },
  attachments: { include: { upload: true } },
} as const;

export const messageDto = (m: MessageRow): TicketMessageDto => ({
  id: m.id,
  ticketId: m.ticketId,
  author: { ...person(m.author), role: Role.parse(m.author.role) },
  body: m.body,
  createdAt: m.createdAt.toISOString(),
  attachments: m.attachments.map((a) => uploadDto(a.upload)),
});

export const alertDto = (a: Alert & { author: Pick<User, 'id' | 'name'> }): AlertDto => ({
  id: a.id,
  level: AlertLevelEnum.catch('info').parse(a.level),
  labels: parseLabels(a.labels),
  districtId: a.districtId,
  cropId: a.cropId,
  author: person(a.author),
  createdAt: a.createdAt.toISOString(),
});

export const notificationDto = (n: Notification): NotificationDto => ({
  id: n.id,
  type: NotificationTypeEnum.parse(n.type),
  refId: n.refId,
  title: parseLabels(n.title),
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});
