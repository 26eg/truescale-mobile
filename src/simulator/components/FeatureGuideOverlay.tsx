import { useEffect, useRef } from 'react';
import {
  Camera,
  Gauge,
  HelpCircle,
  Lightbulb,
  RotateCw,
  Ruler,
  Smartphone,
  X,
} from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';

interface FeatureGuideOverlayProps {
  open: boolean;
  isCalibrated: boolean;
  onClose: () => void;
  onOpenCalibration: () => void;
  t: (k: TranslationKeys) => string;
}

export function FeatureGuideOverlay({
  open,
  isCalibrated,
  onClose,
  onOpenCalibration,
  t,
}: FeatureGuideOverlayProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cards = [
    {
      icon: Smartphone,
      accent: 'text-[#007AFF] bg-[#007AFF]/10 dark:text-[#64D2FF] dark:bg-[#0A84FF]/15',
      title: t('guideCard1Title'),
      desc: t('guideCard1Desc'),
    },
    {
      icon: Gauge,
      accent: 'text-indigo-600 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-400/15',
      title: t('guideCard2Title'),
      desc: t('guideCard2Desc'),
    },
    {
      icon: RotateCw,
      accent: 'text-violet-600 bg-violet-500/10 dark:text-violet-300 dark:bg-violet-400/15',
      title: t('guideCard3Title'),
      desc: t('guideCard3Desc'),
    },
    {
      icon: Camera,
      accent: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-400/15',
      title: t('guideCard4Title'),
      desc: t('guideCard4Desc'),
    },
    {
      icon: Ruler,
      accent: 'text-amber-600 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-400/15',
      title: t('guideCard5Title'),
      desc: t('guideCard5Desc'),
    },
    {
      icon: Lightbulb,
      accent: 'text-rose-600 bg-rose-500/10 dark:text-rose-300 dark:bg-rose-400/15',
      title: t('guideCard6Title'),
      desc: t('guideCard6Desc'),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-guide-title"
      className="absolute inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-white/75 p-5 backdrop-blur-md dark:bg-[#0D0D0F]/78"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="my-auto w-full max-w-4xl rounded-3xl border border-black/[0.08] bg-white p-6 text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#007AFF]/12 text-[#007AFF] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="ts-guide-title" className="text-base font-bold tracking-tight">
                {t('guideTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
                {t('guideSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="cursor-pointer rounded-full bg-black/[0.05] p-1.5 text-[#6E6E73] transition hover:bg-black/10 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:bg-white/10 dark:text-[#98989D]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/85 p-3.5 text-xs dark:border-white/[0.1] dark:bg-[#2C2C2E]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${c.accent}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{c.title}</h3>
                </div>
                <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">{c.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
          {!isCalibrated && (
            <>
              <p className="me-auto max-w-md text-xs leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
                {t('guideCalibrateWhy')}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCalibration();
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#FF9500]/45 bg-[#FF9500]/12 px-4 py-2 text-xs font-semibold text-[#B25000] transition hover:bg-[#FF9500]/20 dark:text-[#FF9F0A]"
              >
                <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('guideCalibrateBtn')}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-[#007AFF] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0066D6] dark:bg-[#0A84FF]"
          >
            {t('guideStartBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
