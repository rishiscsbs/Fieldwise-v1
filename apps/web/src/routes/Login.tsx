// Sign in: a split screen. One side is a farmland photo that breaks into blocks under the cursor (Grid
// Distortion) with the wordmark; the other is a glass form over the field texture. Phone + one-time code; in
// development the API returns the code and lists demo accounts, shown as tappable role cards.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { AuthSession } from '@fieldwise/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { PublicHeader } from '../components/PublicHeader';
import { Button } from '../components/Button';
import { Callout, Field, inputClass } from '../components/ui';
import { HeroImage } from '../components/signature/HeroImage';
import { Wordmark } from '../components/signature/Wordmark';
import { loginPhoto } from '../lib/photos';

type Role = 'farmer' | 'officer' | 'admin';

interface DemoAccount {
  role: Role;
  name: string;
  phone: string;
}

/** Small original drawings for the role cards: a sprouting field, a field notebook, a control board. */
function RoleArt({ role }: { role: Role }) {
  const common = { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': true, fill: 'none' } as const;
  if (role === 'farmer')
    return (
      <svg {...common}>
        <circle cx="33" cy="11" r="5" fill="var(--accent)" />
        <path d="M4 36c8-4 28-4 36 0" stroke="var(--season-a)" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M8 40c8-3 20-3 28 0"
          stroke="var(--season-a)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".6"
        />
        <path d="M18 34V22" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M18 25c-6 0-8-4-8-7 5 0 8 2 8 7Z" fill="var(--primary)" />
        <path d="M18 23c0-6 4-8 8-8 0 5-3 8-8 8Z" fill="var(--primary)" opacity=".75" />
      </svg>
    );
  if (role === 'officer')
    return (
      <svg {...common}>
        <rect
          x="9"
          y="6"
          width="26"
          height="33"
          rx="4"
          fill="var(--surface-2)"
          stroke="var(--primary)"
          strokeWidth="2.5"
        />
        <rect x="16" y="3" width="12" height="7" rx="2" fill="var(--accent)" />
        <path d="M14 18h16M14 24h11" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 35c0-5 3-7 7-7 0 4-3 7-7 7Z" fill="var(--season-a)" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect
        x="5"
        y="7"
        width="34"
        height="30"
        rx="5"
        fill="var(--surface-2)"
        stroke="var(--primary)"
        strokeWidth="2.5"
      />
      {[14, 22, 30].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 13v18`} stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={x} cy={[26, 17, 22][i]} r="3.5" fill={i === 1 ? 'var(--accent)' : 'var(--season-a)'} />
        </g>
      ))}
    </svg>
  );
}

/** Phone + one-time code. In development the API returns the code and lists demo accounts. */
export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useAuth((s) => s.status);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoAccount[]>([]);
  const codeInput = useRef<HTMLInputElement>(null);
  const next = params.get('next') || '/app';
  // Sized to the screen: a small banner on phones.
  const [photo] = useState(loginPhoto);

  useEffect(() => {
    api<{ enabled: boolean; accounts: DemoAccount[] }>('/dev/demo-accounts')
      .then((r) => setDemo(r.enabled ? r.accounts : []))
      .catch(() => setDemo([]));
  }, []);
  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  if (status === 'signedIn') return <Navigate to={next} replace />;

  const request = async (p = phone) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ sent: true; devCode?: string }>('/auth/otp/request', { body: { phone: p } });
      setPhone(p);
      setDevCode(r.devCode ?? null);
      setCode(r.devCode ?? '');
      setStep('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api<AuthSession>('/auth/otp/verify', { body: { phone, code } });
      useAuth.getState().setSession(s);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="field-bg" aria-hidden="true" />
      <PublicHeader />
      <main
        id="main"
        className="grid min-h-[calc(100dvh-4rem)] grid-rows-[auto_1fr] md:grid-cols-[1.05fr_1fr] md:grid-rows-1"
      >
        <section className="relative isolate flex h-56 items-end overflow-hidden sm:h-72 md:h-auto">
          <HeroImage src={photo} priority className="absolute inset-0 -z-10" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-[5] bg-gradient-to-t from-black/45 via-transparent to-transparent"
          />
          <div className="w-full p-4 sm:p-8 md:p-12">
            <div className="glass max-w-md bg-glass-strong p-4 sm:p-6">
              <Wordmark size={92} className="text-fg" />
              <p className="mt-1 text-base sm:text-lg">{t('login.tagline')}</p>
            </div>
          </div>
        </section>

        <div className="flex justify-center px-4 py-8 sm:px-8 md:items-center md:py-12">
          <div className="flex w-full max-w-md flex-col gap-6">
            <m.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-6 sm:p-8"
            >
              <h1 className="font-display text-3xl">{t('login.title')}</h1>
              <p className="mb-6 mt-1 text-fg-muted">{t('login.lead')}</p>
              {error && (
                <div className="mb-4">
                  <Callout tone="bad" title={error} />
                </div>
              )}
              {step === 'phone' ? (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void request();
                  }}
                >
                  <Field label={t('login.phone')} hint={t('login.phoneHint')} htmlFor="phone">
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Button type="submit" variant="primary" magnetic busy={busy}>
                    {t('login.send')}
                  </Button>
                </form>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={verify}>
                  <Field label={t('login.code')} hint={t('login.codeHint', { phone })} htmlFor="code">
                    <input
                      ref={codeInput}
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className={`${inputClass} num text-2xl tracking-[0.4em]`}
                    />
                  </Field>
                  {devCode && (
                    <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                      {t('login.devCode', { code: devCode })}
                    </p>
                  )}
                  <Button type="submit" variant="primary" magnetic busy={busy}>
                    {t('login.verify')}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="quiet" onClick={() => setStep('phone')}>
                      {t('login.change')}
                    </Button>
                    <Button variant="quiet" onClick={() => void request()} disabled={busy}>
                      {t('login.resend')}
                    </Button>
                  </div>
                </form>
              )}
            </m.section>

            {demo.length > 0 && (
              <section aria-labelledby="demo-title">
                <h2 id="demo-title" className="text-xl font-semibold">
                  {t('login.demo')}
                </h2>
                <p className="text-sm text-fg-muted">
                  {t('login.demoPick')} {t('login.demoNote')}
                </p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                  {demo.map((a, i) => (
                    <m.li
                      key={a.phone}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                    >
                      <button
                        type="button"
                        onClick={() => void request(a.phone)}
                        disabled={busy}
                        aria-label={t('login.useDemo', { role: t(`login.role.${a.role}`) })}
                        className="flex h-full min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left shadow-1 transition duration-2 ease-out hover:-translate-y-0.5 hover:border-primary hover:shadow-2 disabled:opacity-60 sm:flex-col sm:items-start sm:p-4"
                      >
                        <RoleArt role={a.role} />
                        <span className="min-w-0">
                          <span className="block font-semibold leading-tight">
                            {t(`login.role.${a.role}`)}
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-fg-muted">
                            {t(`login.roleNote.${a.role}`)}
                          </span>
                          <span className="mt-1 block truncate text-xs text-fg-muted">{a.name}</span>
                        </span>
                      </button>
                    </m.li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
