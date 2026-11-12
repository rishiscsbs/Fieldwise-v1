// Buttons with ripple feedback, and an optional magnetic pull for primary calls to action (desktop pointers only).
import { forwardRef, useRef, type ButtonHTMLAttributes, type MouseEvent, type PointerEvent } from 'react';
import { prefersReducedMotion } from '../lib/effects';

type Variant = 'primary' | 'secondary' | 'quiet';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  magnetic?: boolean;
  busy?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'secondary',
    magnetic,
    busy,
    className = '',
    onClick,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const inner = useRef<HTMLButtonElement | null>(null);

  const ripple = (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${(e.clientX || r.left + r.width / 2) - r.left - size / 2}px`;
    dot.style.top = `${(e.clientY || r.top + r.height / 2) - r.top - size / 2}px`;
    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  };

  const pull = (e: PointerEvent<HTMLButtonElement>) => {
    if (!magnetic || e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
    const dy = (e.clientY - (r.top + r.height / 2)) * 0.25;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const release = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <button
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      type={type}
      className={`${VARIANT[variant]} relative overflow-hidden ${magnetic ? 'transition-transform duration-2 ease-out' : ''} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={(e) => {
        ripple(e);
        onClick?.(e);
      }}
      onPointerMove={pull}
      onPointerLeave={release}
      {...rest}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
