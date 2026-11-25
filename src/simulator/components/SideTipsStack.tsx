import { ChevronLeft, ChevronRight, Gauge, Info, Lightbulb, Ruler, Sparkles, X } from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';
import type { CalibrationProfile, ViewScaleMode } from '../../shared/types';

interface SideTipsStackProps {
  calibration: CalibrationProfile | undefined;
  scaleMode: ViewScaleMode;
  dismissedConflictNotice: boolean;
  dismissedPreviewHint: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCalibration: () => void;
  onSwitchToCrisp: () => void;
  onDismissConflictNotice: () => void;
  onDismissPreviewHint: () => void;
  t: (k: TranslationKeys) => string;
}

export function SideTipsStack({
  calibration,
  scaleMode,
  dismissedConflictNotice,
  dismissedPreviewHint,
  collapsed,
  onToggleCollapse,
  onOpenCalibration,
  onSwitchToCrisp,
  onDismissConflictNotice,
  onDismissPreviewHint,
  t,
}: SideTipsStackProps) {
  const showUncalibrated = !calibration?.isCalibrated;
  const showModeNotice = scaleMode === 'fit-window' || scaleMode === 'pixel-crisp';
  const showClarityTip = scaleMode === 'true-size' || scaleMode === 'fit-window';
  const showFeatureTip = !dismissedConflictNotice;
  const showPreviewTip = !dismissedPreviewHint;

  const activeCount =
    (showUncalibrated ? 1 : 0) +
    (showModeNotice ? 1 : 0) +
    (showClarityTip ? 1 : 0) +
    (showFeatureTip ? 1 : 0) +
    (showPreviewTip ? 1 : 0);

  if (activeCount === 0) return null;

  if (collapsed) {
    return (
      <div className="pointer-events-none absolute left-[16px] top-[12px] z-30 flex">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={false}
          aria-label={`${t('expandPanel')} ${t('tipsButtonLabel')}`}
          className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-lg backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:border-white/[0.12] dark:bg-[#1C1C1E]/95 dark:text-[#F5F5F7]"
        >
          <Lightbulb
            className={`h-3.5 w-3.5 ${showUncalibrated ? 'text-[#FF9500]' : 'text-[#007AFF] dark:text-[#0A84FF]'}`}
            aria-hidden="true"
          />
          <span>
            {t('tipsButtonLabel')} · {activeCount}
          </span>
          {showUncalibrated && <span className="h-2 w-2 rounded-full bg-[#FF9500]" />}
          <ChevronRight className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t('tipsButtonLabel')}
      className="pointer-events-none absolute left-[16px] top-[12px] z-30 flex max-h-[calc(100%-24px)] w-[276px] flex-col gap-2.5 overflow-y-auto pe-0.5"
    >
      {/* Drawer Header Pill with Collapse Button */}
      <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] shadow-md backdrop-blur-md dark:border-white/[0.12] dark:bg-[#1C1C1E]/95 dark:text-[#F5F5F7]">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
          <span>
            {t('tipsButtonLabel')} ({activeCount})
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={true}
          aria-label={`${t('collapsePanel')} ${t('tipsButtonLabel')}`}
          className="flex cursor-pointer items-center gap-0.5 rounded-lg bg-[#F5F5F7] px-2 py-0.5 text-xs font-medium text-[#6E6E73] transition hover:bg-slate-200 hover:text-[#1D1D1F] dark:bg-[#2C2C2E] dark:text-[#98989D] dark:hover:text-[#F5F5F7]"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('collapsePanel')}</span>
        </button>
      </div>

      {/* Fixed Tip 1 (No close button): Uncalibrated prompt */}
      {showUncalibrated && (
        <div className="pointer-events-auto rounded-2xl border border-[#FF9500]/35 border-s-4 border-s-[#FF9500] bg-white p-3.5 text-xs text-[#1D1D1F] shadow-lg dark:border-[#FF9F0A]/35 dark:border-s-[#FF9F0A] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#B25000] dark:text-[#FF9F0A]">
            <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('tipUncalibratedTitle')}</span>
          </div>
          <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {t('tipUncalibratedReason')}
            </span>
            {t('tipUncalibratedReason').endsWith('；') ? '' : ' '}
            {t('tipUncalibratedBody')}
          </p>
          <button
            type="button"
            onClick={onOpenCalibration}
            className="mt-2.5 w-full cursor-pointer rounded-xl bg-[#FF9500] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#E08600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9500]"
          >
            {t('calibrateNowShort')}
          </button>
        </div>
      )}

      {/* Fixed Tip 2 (No close button): Active Scale Mode Notice */}
      {showModeNotice && (
        <div
          className={`pointer-events-auto rounded-2xl border border-s-4 bg-white p-3.5 text-xs shadow-lg dark:bg-[#1C1C1E] dark:text-[#F5F5F7] ${
            scaleMode === 'fit-window'
              ? 'border-amber-500/35 border-s-amber-500 text-amber-900 dark:border-[#FF9F0A]/35 dark:border-s-[#FF9F0A]'
              : 'border-[#007AFF]/25 border-s-[#007AFF] text-[#1D1D1F] dark:border-[#0A84FF]/35 dark:border-s-[#0A84FF]'
          }`}
        >
          <div
            className={`mb-1 flex items-center gap-1.5 font-semibold ${
              scaleMode === 'fit-window'
                ? 'text-amber-800 dark:text-[#FF9F0A]'
                : 'text-[#0066D6] dark:text-[#64D2FF]'
            }`}
          >
            <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('modeNoticeTitle')}</span>
          </div>
          <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
            {scaleMode === 'fit-window' ? t('nonTrueScaleWarning') : t('pixelCrispNotice')}
          </p>
        </div>
      )}

      {/* Fixed Tip 3 (No close button): 1080P Clarity Explanation in 1:1 & Fit-Window */}
      {showClarityTip && (
        <div className="pointer-events-auto rounded-2xl border border-[#007AFF]/25 border-s-4 border-s-[#007AFF] bg-white p-3.5 text-xs text-[#1D1D1F] shadow-lg dark:border-[#0A84FF]/35 dark:border-s-[#0A84FF] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#0066D6] dark:text-[#64D2FF]">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('lowPpiClarityTitle')}</span>
          </div>
          <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
            {t('lowPpiClarityTip')}
          </p>
          <button
            type="button"
            onClick={onSwitchToCrisp}
            className="mt-2.5 w-full cursor-pointer rounded-xl bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0066D6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:bg-[#0A84FF]"
          >
            {t('switchToCrisp')}
          </button>
        </div>
      )}

      {/* Dismissible Tip 4 (Has close button): Conflict / layout notice */}
      {showFeatureTip && (
        <div className="pointer-events-auto relative rounded-2xl border border-amber-500/30 border-s-4 border-s-amber-500 bg-white p-3.5 pe-8 text-xs text-[#1D1D1F] shadow-lg dark:border-amber-400/30 dark:bg-[#1C1C1E] dark:text-[#F5F5F7]">
          <button
            type="button"
            onClick={onDismissConflictNotice}
            aria-label={t('dismiss')}
            title={t('dismiss')}
            className="absolute end-2.5 top-2.5 cursor-pointer rounded-full p-1 text-[#6E6E73] transition hover:bg-black/[0.06] hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:text-[#98989D] dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('tipFeatureTitle')}</span>
          </div>
          <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
            {t('conflictBannerBody')}
          </p>
        </div>
      )}

      {/* Dismissible Tip 5 (Has close button): Preview capabilities hint */}
      {showPreviewTip && (
        <div className="pointer-events-auto relative rounded-2xl border border-black/[0.08] border-s-4 border-s-[#34C759] bg-white p-3.5 pe-8 text-xs text-[#1D1D1F] shadow-lg dark:border-white/[0.12] dark:border-s-[#30D158] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]">
          <button
            type="button"
            onClick={onDismissPreviewHint}
            aria-label={t('dismiss')}
            title={t('dismiss')}
            className="absolute end-2.5 top-2.5 cursor-pointer rounded-full p-1 text-[#6E6E73] transition hover:bg-black/[0.06] hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:text-[#98989D] dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#248A3D] dark:text-[#30D158]">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('previewHintTitle')}</span>
          </div>
          <p className="leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
            {t('iframeWarningHint')}
          </p>
        </div>
      )}
    </aside>
  );
}
