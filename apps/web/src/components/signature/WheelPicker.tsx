// A curved Option Wheel for short, important choices (season, crop, soil type). A real <select> is always the
// control: in full motion it is visually hidden under the wheel and carries focus, keyboard and screen-reader
// use, while the wheel follows its value and adds drag, scroll and tap. Lite and reduced motion show the
// <select> itself.
import { lazy, Suspense, useId, useRef } from 'react';
import { inputClass } from '../ui';
import { useRich } from './rich';

const OptionWheel = lazy(() => import('../reactbits/OptionWheel'));

export interface WheelOption<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  label: string;
  options: WheelOption<V>[];
  value: V;
  /** `from` is the control, so season changes can sweep colour out from it. */
  onChange: (value: V, from: Element | null) => void;
  /** Wheel height in px; about three rows show at the default font size. */
  height?: number;
  className?: string;
}

export function WheelPicker<V extends string>({
  label,
  options,
  value,
  onChange,
  height = 168,
  className = '',
}: Props<V>) {
  const rich = useRich();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const select = (hidden: boolean) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as V, box.current ?? e.currentTarget)}
      className={hidden ? 'peer sr-only' : inputClass}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-fg-muted">
        {label}
      </label>
      {rich ? (
        <div
          ref={box}
          className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
          style={{ height }}
        >
          {select(true)}
          {/* The highlight band behind the chosen row. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-1/2 h-12 -translate-y-1/2 rounded-lg bg-accent-soft"
          />
          <div aria-hidden="true" className="absolute inset-0">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center font-display text-2xl text-primary">
                  {options[index]?.label}
                </div>
              }
            >
              <OptionWheel
                items={options.map((o) => o.label)}
                defaultSelected={index}
                selected={index}
                focusable={false}
                ariaLabel={label}
                onChange={(i) => {
                  const next = options[i];
                  if (next && next.value !== value) onChange(next.value, box.current);
                }}
                textColor="var(--text-muted)"
                activeColor="var(--primary)"
                fontSize={1.5}
                spacing={1.6}
                tilt={14}
                blur={0.6}
                fade={0.32}
                minOpacity={0.15}
                inset={24}
                className="font-display"
              />
            </Suspense>
          </div>
        </div>
      ) : (
        select(false)
      )}
    </div>
  );
}
