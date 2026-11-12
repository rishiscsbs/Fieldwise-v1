// Animated architecture diagram: boxes for each part of the system, lines between them, and data packets
// travelling along the lines. Packets are left out under reduced motion; the diagram itself stays.
import { useTranslation } from 'react-i18next';

type NodeId = 'phone' | 'app' | 'api' | 'engine' | 'db' | 'weather' | 'mandi' | 'sockets';

const NODES: Record<NodeId, { x: number; y: number; external?: boolean }> = {
  phone: { x: 100, y: 230 },
  app: { x: 280, y: 230 },
  api: { x: 480, y: 230 },
  engine: { x: 480, y: 380 },
  db: { x: 700, y: 380 },
  weather: { x: 700, y: 80, external: true },
  mandi: { x: 820, y: 230, external: true },
  sockets: { x: 280, y: 80 },
};

/** Edges as paths; packets ride these. */
const EDGES: { id: string; from: NodeId; to: NodeId; d: string; dur: number }[] = [
  { id: 'e-phone-app', from: 'phone', to: 'app', d: 'M160 230 H220', dur: 1.4 },
  { id: 'e-app-api', from: 'app', to: 'api', d: 'M340 230 H420', dur: 1.6 },
  { id: 'e-api-engine', from: 'api', to: 'engine', d: 'M480 260 V350', dur: 1.5 },
  { id: 'e-api-db', from: 'api', to: 'db', d: 'M540 250 C 610 260, 640 320, 680 350', dur: 2 },
  { id: 'e-api-weather', from: 'api', to: 'weather', d: 'M540 210 C 610 200, 640 130, 680 110', dur: 2.2 },
  { id: 'e-api-mandi', from: 'api', to: 'mandi', d: 'M540 230 H760', dur: 2.4 },
  { id: 'e-api-sockets', from: 'api', to: 'sockets', d: 'M440 200 C 400 140, 360 100, 340 90', dur: 1.8 },
  { id: 'e-sockets-phone', from: 'sockets', to: 'phone', d: 'M220 80 C 150 90, 110 150, 100 200', dur: 1.8 },
];

export function Architecture({ animate }: { animate: boolean }) {
  const { t } = useTranslation('app');
  return (
    <svg viewBox="0 0 920 440" className="w-full" role="img" aria-label={t('pitch.arch.label')}>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
        </marker>
      </defs>
      {EDGES.map((e) => (
        <path
          key={e.id}
          id={e.id}
          d={e.d}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={2}
          strokeDasharray="5 5"
          markerEnd="url(#arrow)"
        />
      ))}
      {animate &&
        EDGES.flatMap((e, i) =>
          [0, 0.5].map((offset) => (
            <circle
              key={`${e.id}-${offset}`}
              r={5}
              fill={NODES[e.to].external || NODES[e.from].external ? 'var(--series-2)' : 'var(--series-3)'}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <animateMotion
                dur={`${e.dur}s`}
                repeatCount="indefinite"
                begin={`${(i * 0.23 + offset * e.dur).toFixed(2)}s`}
              >
                <mpath href={`#${e.id}`} />
              </animateMotion>
            </circle>
          )),
        )}
      {(Object.keys(NODES) as NodeId[]).map((id) => {
        const n = NODES[id];
        return (
          <g key={id}>
            <rect
              x={n.x - 64}
              y={n.y - 30}
              width={128}
              height={60}
              rx={12}
              fill={
                n.external ? 'var(--info-soft)' : id === 'engine' ? 'var(--accent-soft)' : 'var(--surface)'
              }
              stroke={n.external ? 'var(--info)' : id === 'engine' ? 'var(--accent)' : 'var(--border)'}
              strokeWidth={2}
            />
            <foreignObject x={n.x - 60} y={n.y - 26} width={120} height={52}>
              <div className="flex h-full items-center justify-center text-center text-[13px] font-semibold leading-tight text-fg">
                {t(`pitch.arch.${id}`)}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
