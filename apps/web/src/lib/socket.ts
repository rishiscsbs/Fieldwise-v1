// Live updates. The socket.io client is loaded after sign-in, so it stays out of the first-load bundle.
import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import type { AlertDto, NotificationDto, TicketDto, TicketMessageDto } from './api-types';
import { qk } from './queries';
import { toast } from '../stores/toast';
import { useAuth } from '../stores/auth';
import i18n from '../i18n';
import { pick } from '@fieldwise/shared';
import { burst, haptic } from './effects';
import { chime } from './sound';

let socket: Socket | null = null;

export async function connectLive(qc: QueryClient): Promise<void> {
  disconnectLive();
  const { io } = await import('socket.io-client');
  // The token is read on every (re)connect, so a refreshed token is picked up automatically.
  const s = io({
    path: '/socket.io',
    auth: (cb) => cb({ token: useAuth.getState().token }),
    transports: ['websocket'],
  });
  socket = s;

  s.on('notification:new', (n: NotificationDto) => {
    void qc.invalidateQueries({ queryKey: qk.notifications });
    if (n.type !== 'alert') toast({ tone: 'info', title: pick(n.title, i18n.language) });
  });
  s.on('alert:new', (a: AlertDto) => {
    void qc.invalidateQueries({ queryKey: qk.alerts });
    toast({
      tone: a.level === 'bad' ? 'bad' : a.level === 'warn' ? 'warn' : 'info',
      title: i18n.t('app:toast.newAlert'),
      body: pick(a.labels, i18n.language),
    });
  });
  const ticketChanged = (t: Pick<TicketDto, 'id'> | Pick<TicketMessageDto, 'ticketId'>) => {
    const id = 'ticketId' in t ? t.ticketId : t.id;
    void qc.invalidateQueries({ queryKey: qk.ticket(id) });
    void qc.invalidateQueries({ queryKey: qk.tickets });
  };
  s.on('ticket:new', ticketChanged);
  s.on('ticket:updated', ticketChanged);
  s.on('ticket:message', (msg: TicketMessageDto) => {
    ticketChanged(msg);
    // A farmer getting an answer is worth a small celebration, a soft chime (if sounds are on) and a buzz.
    if (useAuth.getState().user?.role === 'farmer' && msg.author.role !== 'farmer') {
      void burst();
      chime();
      haptic([10, 60, 10]);
    }
  });
}

export function disconnectLive(): void {
  socket?.close();
  socket = null;
}
