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

interface DemoAccount {
  role: 'farmer' | 'officer' | 'admin';
  name: string;
  phone: string;
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
      <PublicHeader />
      <main
        id="main"
        className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1fr_0.9fr] md:py-16"
      >
        <m.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card self-start sm:p-8"
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
          <m.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="self-start rounded-lg border border-dashed border-line p-5"
          >
            <h2 className="text-xl font-semibold">{t('login.demo')}</h2>
            <p className="mb-4 text-sm text-fg-muted">{t('login.demoNote')}</p>
            <ul className="flex flex-col gap-2">
              {demo.map((a) => (
                <li key={a.phone}>
                  <button
                    type="button"
                    onClick={() => void request(a.phone)}
                    aria-label={t('login.useDemo', { role: t(`login.role.${a.role}`) })}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{t(`login.role.${a.role}`)}</span>
                      <span className="block truncate text-sm text-fg-muted">
                        {a.name} · <span className="num">{a.phone}</span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-sm font-semibold text-primary sm:inline">
                      {t('login.useDemo', { role: t(`login.role.${a.role}`) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </m.aside>
        )}
      </main>
    </>
  );
}
