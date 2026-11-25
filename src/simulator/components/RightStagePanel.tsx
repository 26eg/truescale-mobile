import { ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';
import type { DeviceProfile, Orientation, ScaleMetrics } from '../../shared/types';

interface RightStagePanelProps {
  device: DeviceProfile;
  orientation: Orientation;
  effectiveScale: number;
  metrics: ScaleMetrics;
  collapsed: boolean;
  onToggleCollapse: () => void;
  t: (k: TranslationKeys) => string;
}

export function RightStagePanel({
  device,
  orientation,
  effectiveScale,
  metrics,
  collapsed,
  onToggleCollapse,
  t,
}: RightStagePanelProps) {
  const scaleText = `${(effectiveScale * 100).toFixed(1)}%`;

  if (collapsed) {
    return (
      <div className="pointer-events-none absolute right-[16px] top-[12px] z-30 flex">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={false}
          aria-label={`${t('expandPanel')} ${t('specsButtonLabel')}`}
          className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-lg backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:border-white/[0.12] dark:bg-[#1C1C1E]/95 dark:text-[#F5F5F7]"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
          <Smartphone className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
          <span>
            <span dir="ltr" className="inline-block">
              {scaleText}
            </span>{' '}
            · {t('specsButtonLabel')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t('deviceReadoutTitle')}
      className="pointer-events-none absolute right-[16px] top-[12px] z-30 flex max-h-[calc(100%-24px)] flex-col items-end overflow-y-auto"
    >
      <div className="pointer-events-auto w-max min-w-[276px] max-w-[380px] rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 text-xs text-[#1D1D1F] shadow-lg backdrop-blur-md dark:border-white/[0.12] dark:bg-[#1C1C1E]/95 dark:text-[#F5F5F7]">
        <div className="mb-2.5 flex items-center justify-between gap-2 font-semibold">
          <div className="flex min-w-0 items-center gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7]">
            <Smartphone
              className="h-3.5 w-3.5 shrink-0 text-[#007AFF] dark:text-[#0A84FF]"
              aria-hidden="true"
            />
            <span dir="ltr" className="truncate">
              {device.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="whitespace-nowrap rounded-full bg-[#F5F5F7] px-2 py-0.5 text-xs font-medium text-[#6E6E73] dark:bg-[#2C2C2E] dark:text-[#98989D]">
              {orientation === 'portrait' ? t('portrait') : t('landscape')}
            </span>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={true}
              aria-label={`${t('collapsePanel')} ${t('specsButtonLabel')}`}
              title={t('collapsePanel')}
              className="flex cursor-pointer items-center justify-center rounded-lg bg-[#F5F5F7] p-1 text-[#6E6E73] transition hover:bg-slate-200 hover:text-[#1D1D1F] dark:bg-[#2C2C2E] dark:text-[#98989D] dark:hover:text-[#F5F5F7]"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#F5F5F7] px-2.5 py-1.5 dark:bg-[#2C2C2E]">
            <dt className="shrink-0 whitespace-nowrap text-[#6E6E73] dark:text-[#98989D]">
              {t('physicalReadout')}
            </dt>
            <dd
              dir="ltr"
              className="whitespace-nowrap text-right font-mono font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
            >
              {metrics.physicalWidthMm.toFixed(1)} × {metrics.physicalHeightMm.toFixed(1)} mm (
              {device.diagonalInches}&quot;)
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#F5F5F7] px-2.5 py-1.5 dark:bg-[#2C2C2E]">
            <dt className="shrink-0 whitespace-nowrap text-[#6E6E73] dark:text-[#98989D]">
              {t('viewportReadout')}
            </dt>
            <dd
              dir="ltr"
              className="whitespace-nowrap text-right font-mono font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
            >
              {metrics.viewportWidthPx} × {metrics.viewportHeightPx} · {device.dpr}×
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#007AFF]/10 px-2.5 py-1.5 dark:bg-[#0A84FF]/15">
            <dt className="shrink-0 whitespace-nowrap font-medium text-[#0066D6] dark:text-[#64D2FF]">
              Scale
            </dt>
            <dd
              dir="ltr"
              className="whitespace-nowrap text-right font-mono font-semibold text-[#0066D6] dark:text-[#64D2FF]"
            >
              {scaleText}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
