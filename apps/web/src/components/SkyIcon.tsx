// A small drawn sky for a forecast condition: sun, sun behind cloud, cloud with showers or heavy rain.
import type { Condition } from '../lib/weather';

/** A small drawn sky icon for today's condition. */
export function SkyIcon({ cond, size = 56 }: { cond: Condition; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      {(cond === 'clear' || cond === 'cloudy') && (
        <g>
          <circle
            cx={cond === 'clear' ? 28 : 20}
            cy={cond === 'clear' ? 28 : 20}
            r="11"
            fill="var(--accent)"
          />
          {cond === 'clear' &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <path
                  key={i}
                  d={`M${28 + Math.cos(a) * 16} ${28 + Math.sin(a) * 16}L${28 + Math.cos(a) * 21} ${28 + Math.sin(a) * 21}`}
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
        </g>
      )}
      {cond !== 'clear' && (
        <path
          d="M16 40h24a9 9 0 0 0 0-18 12 12 0 0 0-23-2 8 8 0 0 0-1 20Z"
          fill="var(--surface)"
          stroke="var(--text-muted)"
          strokeWidth="2"
        />
      )}
      {(cond === 'showers' || cond === 'heavy') &&
        [18, 28, 38]
          .slice(0, cond === 'heavy' ? 3 : 2)
          .map((x) => (
            <path
              key={x}
              d={`M${x} 45l-3 7`}
              stroke="var(--season-b)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
    </svg>
  );
}
