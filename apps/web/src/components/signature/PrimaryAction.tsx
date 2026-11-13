// The primary call to action on a screen: a Specular glass button whose rim catches the light. Use it for one
// or two actions per screen ("Grow this", "Send question"); everything else stays a plain Button. Each one owns
// a WebGL context, so never put them in lists. Lite and reduced motion get the regular primary Button.
import { lazy, Suspense, type ButtonHTMLAttributes } from 'react';
import { Button } from '../Button';
import { useRich } from './rich';

const Specular = lazy(() => import('../reactbits/SpecularButton'));

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  type?: 'button' | 'submit';
  busy?: boolean;
  size?: 'md' | 'lg';
}

export function PrimaryAction({ busy, size = 'md', className = '', disabled, children, ...rest }: Props) {
  const rich = useRich();
  const plain = (
    <Button
      variant="primary"
      magnetic
      busy={busy}
      disabled={disabled}
      className={`${size === 'lg' ? 'min-h-12 px-6 text-lg' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Button>
  );
  if (!rich) return plain;
  return (
    <Suspense fallback={plain}>
      <Specular
        size={size}
        radius={size === 'lg' ? 16 : 12}
        tint="var(--primary)"
        tintOpacity={1}
        textColor="var(--primary-ink)"
        lineColor="#ffffff"
        baseColor="#ffffff"
        idleIntensity={0.45}
        glow={1.2}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={`min-h-11 font-semibold shadow-2 ${className}`}
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
