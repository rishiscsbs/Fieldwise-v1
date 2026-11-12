import { m } from 'framer-motion';

/** A switch with a spring-animated thumb. Uses role="switch" so screen readers announce on/off. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line p-0.5 transition-colors duration-2 ${checked ? 'bg-primary' : 'bg-surface-2'}`}
    >
      <m.span
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className={`block h-5 w-5 rounded-full shadow-1 ${checked ? 'ml-auto bg-primary-ink' : 'bg-surface'}`}
      />
    </button>
  );
}
