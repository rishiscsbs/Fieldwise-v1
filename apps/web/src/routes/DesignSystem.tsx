import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Season } from '@fieldwise/shared';
import { PublicHeader } from '../components/PublicHeader';
import { WheelPicker } from '../components/signature/WheelPicker';
import { PrimaryAction } from '../components/signature/PrimaryAction';
import { Wordmark } from '../components/signature/Wordmark';
import { HeroImage } from '../components/signature/HeroImage';
import { CropStrip } from '../components/signature/CropStrip';
import { pickSeason, useSeason } from '../lib/season';

const FAMILIES = ['soil', 'monsoon', 'mustard', 'leaf'] as const;
const STEPS = [900, 700, 500, 300, 100] as const;
const SEMANTIC = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'text',
  'text-muted',
  'primary',
  'accent',
  'focus',
  'season-a',
  'season-b',
  'season-c',
] as const;
const SEASONS: Season[] = ['kharif', 'rabi', 'zaid'];
const STILLS = ['kharif', 'rabi', 'zaid', 'soil'] as const;
const STATUS = [
  { k: 'good', icon: '✓' },
  { k: 'warn', icon: '!' },
  { k: 'bad', icon: '✕' },
  { k: 'info', icon: 'i' },
] as const;
const TYPE = [
  ['text-6xl', 'font-display'],
  ['text-4xl', 'font-display'],
  ['text-3xl', 'font-display'],
  ['text-2xl', 'font-display'],
  ['text-xl', 'font-sans font-semibold'],
  ['text-lg', 'font-sans'],
  ['text-base', 'font-sans'],
  ['text-sm', 'font-sans'],
  ['text-xs', 'font-sans'],
] as const;

// Full class names so Tailwind's scanner can find them.
const RADII = [
  ['sm', 'rounded-sm shadow-1'],
  ['md', 'rounded-md shadow-1'],
  ['lg', 'rounded-lg shadow-2'],
  ['xl', 'rounded-xl shadow-3'],
  ['2xl', 'rounded-2xl shadow-glass'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="min-w-0">
      <div className="h-14 rounded-md border border-line" style={{ background: `var(--${varName})` }} />
      <div className="mt-1 truncate text-xs text-fg-muted">{name}</div>
    </div>
  );
}

export function DesignSystem() {
  const { t } = useTranslation();
  const season = useSeason();
  return (
    <>
      <div className="field-bg" aria-hidden="true" />
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-3xl sm:text-4xl">{t('design.title')}</h1>
        <p className="mt-2 max-w-2xl text-lg text-fg-muted">{t('design.lead')}</p>

        <Section title={t('design.palette')}>
          <div className="grid gap-4">
            {FAMILIES.map((f) => (
              <div key={f}>
                <div className="mb-1 text-sm font-semibold">{f}</div>
                <div className="grid grid-cols-5 gap-2">
                  {STEPS.map((s) => (
                    <Swatch key={s} name={String(s)} varName={`${f}-${s}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t('design.seasons')}>
          <p className="mb-4 max-w-2xl text-fg-muted">{t('design.seasonsLead')}</p>
          <div className="grid items-start gap-6 sm:grid-cols-[16rem_1fr]">
            <WheelPicker
              label={t('season.label')}
              options={SEASONS.map((s) => ({ value: s, label: t(`season.${s}`) }))}
              value={season}
              onChange={(s, from) => pickSeason(s, from)}
            />
            <div className="glass p-5">
              <h3 className="font-display text-2xl">{t('design.glass')}</h3>
              <p className="mt-1 text-fg-muted">{t('design.glassBody')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge bg-accent-soft text-fg">{t(`season.${season}`)}</span>
                <a href="#main" className="font-semibold text-primary underline">
                  {t('design.secondary')}
                </a>
              </div>
            </div>
          </div>
        </Section>

        <Section title={t('design.signature')}>
          <p className="mb-4 max-w-2xl text-fg-muted">{t('design.signatureLead')}</p>
          <div className="grid gap-6 lg:grid-cols-2">
            <HeroImage src="/lite/kharif.jpg" className="h-64 rounded-xl" />
            <div className="flex flex-col justify-center gap-6">
              <Wordmark size={88} />
              <div className="flex flex-wrap items-center gap-3">
                <PrimaryAction size="lg">{t('design.primary')}</PrimaryAction>
                <button className="btn-secondary">{t('design.secondary')}</button>
              </div>
            </div>
          </div>
          <CropStrip
            className="mt-6"
            height={360}
            label={t('design.strip')}
            items={STILLS.map((k) => ({
              src: `/lite/${k}.jpg`,
              alt: '',
              title: k === 'soil' ? t('design.palette') : t(`season.${k}`),
            }))}
          />
        </Section>

        <Section title={t('design.semantic')}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-12">
            {SEMANTIC.map((s) => (
              <Swatch key={s} name={s} varName={s} />
            ))}
          </div>
        </Section>

        <Section title={t('design.status')}>
          <div className="flex flex-wrap gap-3">
            {STATUS.map(({ k, icon }) => (
              <span
                key={k}
                className="badge"
                style={{ background: `var(--${k}-soft)`, color: `var(--${k})` }}
              >
                <span aria-hidden="true">{icon}</span>
                {t(`design.${k}`)}
              </span>
            ))}
            <span className="badge border border-line bg-surface-2 text-fg-muted">{t('simulated')}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {STATUS.map(({ k, icon }) => (
              <div
                key={k}
                className="rounded-md border-l-4 p-3"
                style={{ background: `var(--${k}-soft)`, borderColor: `var(--${k})` }}
              >
                <b style={{ color: `var(--${k})` }}>
                  <span aria-hidden="true">{icon} </span>
                  {t(`design.${k}`)}
                </b>
                <p className="text-sm">{t('advice:fungal')}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t('design.series')}>
          <div className="flex h-32 items-end gap-3" role="img" aria-label={t('design.series')}>
            {[0.9, 0.65, 0.45, 0.3].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${h * 100}%`, background: `var(--series-${i + 1})` }}
              />
            ))}
          </div>
        </Section>

        <Section title={t('design.type')}>
          <div className="space-y-3">
            {TYPE.map(([size, face]) => (
              <div key={size} className="flex items-baseline gap-4 border-b border-line pb-3">
                <code className="w-20 shrink-0 text-xs text-fg-muted">{size}</code>
                <span className={`${size} ${face} min-w-0 break-words`}>{t('design.sample')}</span>
              </div>
            ))}
            <p className="text-base">{t('common:crops_sub')}</p>
            <p className="num text-4xl font-display">₹ 2,425 · 18.5 q</p>
          </div>
        </Section>

        <Section title={t('design.buttons')}>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary">{t('design.primary')}</button>
            <button className="btn-secondary">{t('design.secondary')}</button>
            <button className="btn-quiet">{t('design.quiet')}</button>
            <button className="btn-primary" disabled>
              {t('design.primary')}
            </button>
          </div>
        </Section>

        <Section title={t('design.radius')}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {RADII.map(([r, cls]) => (
              <div
                key={r}
                className={`flex h-24 items-center justify-center border border-line bg-surface ${cls}`}
              >
                <code className="text-xs text-fg-muted">rounded-{r}</code>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
