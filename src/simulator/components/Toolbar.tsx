import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Coffee,
  HelpCircle,
  LogOut,
  PanelTop,
  RotateCw,
  Ruler,
  ScanLine,
  Settings,
  Smartphone,
} from 'lucide-react';
import { SPONSOR_CONFIG } from '../../config/sponsor';
import type { TranslationKeys } from '../../shared/i18n';
import type {
  CalibrationProfile,
  DeviceProfile,
  Orientation,
  ViewScaleMode,
} from '../../shared/types';
import type { CaptureKind } from '../utils/screenshot';
import { DeviceSelector } from './DeviceSelector';

interface ToolbarProps {
  devices: DeviceProfile[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onOpenCustomDevice: () => void;
  orientation: Orientation;
  onToggleOrientation: () => void;
  showFrame: boolean;
  onToggleFrame: () => void;
  showBrowserBars: boolean;
  onToggleBrowserBars: () => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
  scaleMode: ViewScaleMode;
  onChangeScaleMode: (mode: ViewScaleMode) => void;
  calibration: CalibrationProfile | undefined;
  cssPxPerMm: number;
  onOpenCalibration: () => void;
  onCapture: (kind: CaptureKind) => void;
  capturing: boolean;
  captureProgress: number | null;
  onExitInPlace?: () => void;
  onOpenSettings: () => void;
  onOpenSponsor: () => void;
  onOpenGuide: () => void;
  t: (k: TranslationKeys) => string;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:focus-visible:ring-[#0A84FF]';

export function Toolbar({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onOpenCustomDevice,
  orientation,
  onToggleOrientation,
  showFrame,
  onToggleFrame,
  showBrowserBars,
  onToggleBrowserBars,
  showSafeArea,
  onToggleSafeArea,
  scaleMode,
  onChangeScaleMode,
  calibration,
  cssPxPerMm,
  onOpenCalibration,
  onCapture,
  capturing,
  captureProgress,
  onExitInPlace,
  onOpenSettings,
  onOpenSponsor,
  onOpenGuide,
  t,
}: ToolbarProps) {
  const [captureMenuOpen, setCaptureMenuOpen] = useState(false);
  const captureContainerRef = useRef<HTMLDivElement | null>(null);
  const captureItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!captureMenuOpen) return;
    const onPointerDown = (e: Event) => {
      const path = e.composedPath();
      if (captureContainerRef.current && !path.includes(captureContainerRef.current)) {
        setCaptureMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [captureMenuOpen]);

  useEffect(() => {
    if (captureMenuOpen) {
      window.setTimeout(() => {
        captureItemRefs.current[0]?.focus();
      }, 0);
    }
  }, [captureMenuOpen]);

  const scaleOptions = [
    { id: 'true-size' as const, label: t('trueScaleMode'), tip: t('scaleTrueTip') },
    { id: 'pixel-crisp' as const, label: t('pixelCrispMode'), tip: t('scaleCrispTip') },
    { id: 'fit-window' as const, label: t('fitToWindow'), tip: t('scaleFitTip') },
  ];

  const captureItems: Array<{ kind: CaptureKind; label: string; highlight?: boolean; strong?: boolean }> =
    [
      { kind: 'screen', label: t('screenshotScreen') },
      { kind: 'framed-transparent', label: t('screenshotTransparent') },
      { kind: 'fullPage', label: t('screenshotFullPage'), highlight: true },
      { kind: 'fullPage-framed', label: t('screenshotFullPageFramed'), highlight: true, strong: true },
    ];

  const handleCaptureMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!captureMenuOpen) return;
    const root = captureContainerRef.current?.getRootNode() as Document | ShadowRoot | undefined;
    const active = root && 'activeElement' in root ? root.activeElement : document.activeElement;
    const idx = captureItemRefs.current.findIndex((el) => el === active);

    if (e.key === 'Escape') {
      e.preventDefault();
      setCaptureMenuOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1 + captureItems.length) % captureItems.length;
      captureItemRefs.current[next]?.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + captureItems.length) % captureItems.length;
      captureItemRefs.current[prev]?.focus();
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      captureItemRefs.current[0]?.focus();
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      captureItemRefs.current[captureItems.length - 1]?.focus();
    }
  };

  return (
    <header className="relative z-50 flex flex-wrap items-center justify-center gap-2 border-b border-black/[0.08] bg-white px-4 py-2 text-xs text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]">
      {/* Group 1: Device Selector */}
      <div className="flex items-center gap-1.5">
        <DeviceSelector
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
          onOpenCustomDevice={onOpenCustomDevice}
          t={t}
        />
      </div>

      <div className="hidden h-5 w-px bg-black/10 md:block dark:bg-white/[0.12]" />

      {/* Group 2: Scale Segmented Control */}
      <div className="flex items-center gap-1.5">
        <div
          role="radiogroup"
          aria-label="Display Scale Mode"
          className="flex items-center rounded-xl bg-[#E5E5EA]/85 p-0.5 text-xs dark:bg-[#2C2C2E]"
        >
          {scaleOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={scaleMode === item.id}
              title={item.tip}
              onClick={() => onChangeScaleMode(item.id)}
              className={`cursor-pointer rounded-lg px-2.5 py-1 font-medium transition ${FOCUS_RING} ${
                scaleMode === item.id
                  ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#0A84FF] dark:text-white'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:text-[#F5F5F7]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group 3: Orientation, Frame, Browser Bars */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleOrientation}
          title={orientation === 'portrait' ? t('portrait') : t('landscape')}
          aria-label={orientation === 'portrait' ? t('portrait') : t('landscape')}
          aria-pressed={orientation === 'landscape'}
          className={`flex cursor-pointer items-center gap-1 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 font-medium text-[#1D1D1F] transition hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] ${FOCUS_RING}`}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">
            {orientation === 'portrait' ? t('portrait') : t('landscape')}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleFrame}
          title={t('showFrame')}
          aria-label={t('showFrame')}
          aria-pressed={showFrame}
          className={`flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 font-medium transition ${FOCUS_RING} ${
            showFrame
              ? 'border-[#007AFF]/30 bg-[#007AFF]/10 text-[#0066D6] dark:border-[#0A84FF]/35 dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]'
              : 'border-black/10 bg-white text-[#6E6E73] hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#98989D]'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">{t('showFrame')}</span>
        </button>

        <button
          type="button"
          onClick={onToggleBrowserBars}
          title={t('browserBars')}
          aria-label={t('browserBars')}
          aria-pressed={showBrowserBars}
          className={`flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 font-medium transition ${FOCUS_RING} ${
            showBrowserBars
              ? 'border-[#007AFF]/30 bg-[#007AFF]/10 text-[#0066D6] dark:border-[#0A84FF]/35 dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]'
              : 'border-black/10 bg-white text-[#6E6E73] hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#98989D]'
          }`}
        >
          <PanelTop className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">{t('browserBars')}</span>
        </button>

        <button
          type="button"
          onClick={onToggleSafeArea}
          title={t('safeAreaToggle')}
          aria-label={t('safeAreaToggle')}
          aria-pressed={showSafeArea}
          className={`flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 font-medium transition ${FOCUS_RING} ${
            showSafeArea
              ? 'border-violet-500/35 bg-violet-500/12 text-violet-700 dark:border-violet-400/35 dark:bg-violet-400/20 dark:text-violet-300'
              : 'border-black/10 bg-white text-[#6E6E73] hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#98989D]'
          }`}
        >
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">{t('safeAreaToggle')}</span>
        </button>
      </div>

      <div className="hidden h-5 w-px bg-black/10 md:block dark:bg-white/[0.12]" />

      {/* Group 4: Screenshot & Calibration */}
      <div
        ref={captureContainerRef}
        className="relative"
        onKeyDown={handleCaptureMenuKeyDown}
      >
        <button
          type="button"
          disabled={capturing}
          aria-haspopup="menu"
          aria-expanded={captureMenuOpen}
          aria-label={t('screenshot')}
          onClick={() => setCaptureMenuOpen((prev) => !prev)}
          className={`flex cursor-pointer items-center gap-1 rounded-xl border border-black/10 bg-white px-2.5 py-1.5 font-medium text-[#1D1D1F] transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] ${FOCUS_RING}`}
        >
          <Camera className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
          <span>{captureProgress !== null ? `${captureProgress}%` : t('screenshot')}</span>
        </button>

        {captureMenuOpen && (
          <div
            role="menu"
            aria-label={t('screenshot')}
            className="absolute left-1/2 top-full z-[70] mt-1.5 w-max min-w-[152px] -translate-x-1/2 rounded-2xl border border-black/10 bg-white p-1.5 text-[#1D1D1F] shadow-2xl dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
          >
            {captureItems.map((item, idx) => (
              <button
                key={item.kind}
                ref={(el) => {
                  captureItemRefs.current[idx] = el;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCaptureMenuOpen(false);
                  onCapture(item.kind);
                }}
                className={`flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-start text-xs hover:bg-[#F5F5F7] focus-visible:bg-[#F5F5F7] focus-visible:outline-none dark:hover:bg-[#2C2C2E] dark:focus-visible:bg-[#2C2C2E] ${
                  item.strong ? 'font-semibold' : 'font-medium'
                } ${item.highlight ? 'text-[#007AFF] dark:text-[#64D2FF]' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCalibration}
        title={calibration?.isCalibrated ? t('recalibrate') : t('calibrateNow')}
        className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-medium transition ${FOCUS_RING} ${
          calibration?.isCalibrated
            ? 'border-[#34C759]/30 bg-[#34C759]/12 text-[#248A3D] hover:bg-[#34C759]/20 dark:border-[#30D158]/30 dark:text-[#30D158]'
            : 'border-[#FF9500]/50 bg-[#FF9500]/18 text-[#B25000] ring-1 ring-[#FF9500]/30 hover:bg-[#FF9500]/25 dark:border-[#FF9F0A]/45 dark:text-[#FF9F0A]'
        }`}
      >
        {calibration?.isCalibrated ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Ruler className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">
          {calibration?.isCalibrated ? t('recalibrate') : t('calibrateNow')} ·{' '}
          <span dir="ltr" className="inline-block font-mono">
            {cssPxPerMm.toFixed(2)} px/mm
          </span>
        </span>
      </button>

      {/* Group 5: Guide, Settings, Sponsor & Exit */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenGuide}
          title={t('featureGuideBtn')}
          aria-label={t('featureGuideBtn')}
          className={`cursor-pointer rounded-xl border border-black/10 bg-white p-1.5 text-[#007AFF] transition hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#64D2FF] ${FOCUS_RING}`}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title={t('settings')}
          aria-label={t('settings')}
          className={`cursor-pointer rounded-xl border border-black/10 bg-white p-1.5 text-[#3A3A3C] transition hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] ${FOCUS_RING}`}
        >
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {SPONSOR_CONFIG.enabled && (
          <button
            type="button"
            onClick={onOpenSponsor}
            title={t('supportAuthor')}
            aria-label={t('supportAuthor')}
            className={`flex cursor-pointer items-center gap-1 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-[#FF9500] transition hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] ${FOCUS_RING}`}
          >
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        {onExitInPlace && (
          <button
            type="button"
            onClick={onExitInPlace}
            title={t('exitInPlace')}
            aria-label={t('exitInPlace')}
            className={`flex cursor-pointer items-center gap-1 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400 ${FOCUS_RING}`}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('exitInPlace')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
