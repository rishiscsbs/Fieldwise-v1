// Stores notifications for the notification centre and pushes them live.
import type { FastifyInstance } from 'fastify';
import type { Labels, NotificationDto } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { notificationDto } from '../lib/dto.js';
import { toJson } from '../lib/json.js';
import { rooms } from './realtime.js';

export async function notify(
  app: FastifyInstance,
  userIds: string[],
  n: { type: NotificationDto['type']; refId: string | null; title: Labels },
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const rows = await prisma.notification.createManyAndReturn({
    data: ids.map((userId) => ({ userId, type: n.type, refId: n.refId, title: toJson(n.title) })),
  });
  for (const row of rows) app.rt.emit(rooms.user(row.userId), 'notification:new', notificationDto(row));
}
