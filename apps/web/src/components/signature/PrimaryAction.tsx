// The primary call to action on a screen: a Specular glass button whose rim catches the light. Use it for one
// or two actions per screen ("Grow this", "Send question"); everything else stays a plain Button. Each one owns
// a WebGL context, so never put them in lists. Lite and reduced motion get the regular primary Button.
// Pass `to` for an action that navigates: it renders a link (client-side routed) with the same look.
import { lazy, Suspense, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { useRich } from './rich';

const Specular = lazy(() => import('../reactbits/SpecularButton'));

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  type?: 'button' | 'submit';
  busy?: boolean;
  size?: 'md' | 'lg';
  /** Navigate here instead of acting in place. */
  to?: string;
  /** `accent` (mustard-style fill, ink text) for dark bands where the primary colour would sink. */
  tone?: 'primary' | 'accent';
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

const SIZE = { md: '', lg: 'min-h-12 px-6 text-lg' } as const;
// Full class names for Tailwind's scanner.
const TONE = {
  primary: 'btn-primary',
  accent: 'btn bg-accent text-ink hover:brightness-105',
} as const;

export function PrimaryAction({
  busy,
  size = 'md',
  to,
  tone = 'primary',
  className = '',
  disabled,
  children,
  onClick,
  ...rest
}: Props) {
  const rich = useRich();
  const navigate = useNavigate();

  const plain = to ? (
    <Link to={to} onClick={onClick} className={`${TONE[tone]} ${SIZE[size]} ${className}`}>
      {children}
    </Link>
  ) : tone === 'primary' ? (
    <Button
      variant="primary"
      magnetic
      busy={busy}
      disabled={disabled}
      onClick={onClick}
      className={`${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </Button>
  ) : (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`${TONE.accent} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
  if (!rich) return plain;

  return (
    <Suspense fallback={plain}>
      <Specular
        href={to}
        size={size}
        radius={size === 'lg' ? 16 : 12}
        tint={tone === 'accent' ? 'var(--accent)' : 'var(--primary)'}
        tintOpacity={1}
        textColor={tone === 'accent' ? 'var(--ink)' : 'var(--primary-ink)'}
        lineColor="#ffffff"
        baseColor="#ffffff"
        idleIntensity={0.45}
        glow={1.2}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={`min-h-11 font-semibold shadow-2 ${className}`}
        onClick={(e) => {
          onClick?.(e);
          // Links route client-side, but keep new-tab and modified clicks native.
          if (to && !e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
            e.preventDefault();
            navigate(to);
          }
        }}
        {...rest}
      >
        {busy && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </Specular>
    </Suspense>
  );
}
