// Socket.IO for live alerts, notifications and ticket updates.
// Clients authenticate with the access token in `auth.token` and are placed in rooms:
//   user:<id>            everything addressed to one person
//   district:<id>        farmers and officers in a district
//   officers:<district>  officers of a district (new tickets)
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { ServerToClientEvents } from '@fieldwise/shared';
import { env } from '../env.js';
import type { AccessClaims } from '../plugins/auth.js';

export const rooms = {
  user: (id: string) => `user:${id}`,
  district: (id: string) => `district:${id}`,
  officers: (district: string) => `officers:${district}`,
};

type Event = keyof ServerToClientEvents;

export class Realtime {
  constructor(private io: Server<Record<string, never>, ServerToClientEvents> | null) {}

  emit<E extends Event>(to: string | string[], event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    if (!this.io || (Array.isArray(to) && !to.length)) return;
    this.io.to(to).emit(event, ...args);
  }

  broadcast<E extends Event>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.io?.emit(event, ...args);
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    rt: Realtime;
  }
}

export function attachRealtime(app: FastifyInstance, enabled: boolean): void {
  if (!enabled) {
    app.decorate('rt', new Realtime(null));
    return;
  }
  const io = new Server<Record<string, never>, ServerToClientEvents>(app.server, {
    path: '/socket.io',
    cors: { origin: env.WEB_ORIGIN, credentials: true },
    serveClient: false,
  });
  io.use((socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token ?? '');
      socket.data.user = app.jwt.verify<AccessClaims>(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const u = socket.data.user as AccessClaims;
    void socket.join(rooms.user(u.sub));
    if (u.districtId) {
      void socket.join(rooms.district(u.districtId));
      if (u.role === 'officer') void socket.join(rooms.officers(u.districtId));
    }
  });
  app.decorate('rt', new Realtime(io));
  // Disconnect sockets before Fastify closes the HTTP server; io.close() would close the server twice.
  app.addHook('preClose', (done) => {
    io.disconnectSockets(true);
    io.engine.close();
    done();
  });
}
