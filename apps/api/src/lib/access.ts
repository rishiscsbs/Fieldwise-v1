// Who can see and change what.
//   farmer:  their own farms and tickets
//   officer: read farms and handle tickets in their district
//   admin:   read everything
import type { Farm, Prisma, Ticket } from '@prisma/client';
import { prisma } from '../db.js';
import type { AccessClaims } from '../plugins/auth.js';
import { forbidden, notFound } from './http.js';

export function canReadFarm(u: AccessClaims, f: Pick<Farm, 'ownerId' | 'districtId'>): boolean {
  if (u.role === 'admin') return true;
  if (u.role === 'officer') return f.districtId === u.districtId;
  return f.ownerId === u.sub;
}

/** Loads a farm the user may read, or may write when `write` is set (owners only). */
export async function farmFor(u: AccessClaims, id: string, write = false): Promise<Farm> {
  const farm = await prisma.farm.findUnique({ where: { id } });
  if (!farm || !canReadFarm(u, farm)) throw notFound('Farm');
  if (write && farm.ownerId !== u.sub) throw forbidden('Only the farm owner can change this farm');
  return farm;
}

/** Filter for tickets visible to the user. */
export function ticketScope(u: AccessClaims): Prisma.TicketWhereInput {
  if (u.role === 'admin') return {};
  if (u.role === 'officer') return { districtId: u.districtId ?? '__none__' };
  return { farmerId: u.sub };
}

export function canHandleTicket(u: AccessClaims, t: Pick<Ticket, 'districtId'>): boolean {
  return u.role === 'admin' || (u.role === 'officer' && t.districtId === u.districtId);
}

export async function ticketFor(u: AccessClaims, id: string): Promise<Ticket> {
  const t = await prisma.ticket.findFirst({ where: { id, ...ticketScope(u) } });
  if (!t) throw notFound('Question');
  return t;
}
