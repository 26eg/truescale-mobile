import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Monitor,
  Ruler,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { DISPLAY_PRESETS } from '../../config/displays';
import type { ResolvedLocale, TranslationKeys } from '../../shared/i18n';
import {
  ISO_CARD_WIDTH_MM,
  calcCssPxPerMmFromCard,
  calcCssPxPerMmFromRuler,
  calcCssPxPerMmFromSpan,
  estimateCssPxPerMmFromPreset,
} from '../../shared/scale';
import type { CalibrationMethod, CalibrationProfile, DeviceProfile } from '../../shared/types';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface CalibrationModalProps {
  open: boolean;
  onClose: () => void;
  devices: DeviceProfile[];
  monitorKey: string;
  currentProfile: CalibrationProfile | undefined;
  allProfiles: Record<string, CalibrationProfile>;
  onSaveProfile: (profile: CalibrationProfile) => Promise<void>;
  onDeleteProfile: (monitorKey: string) => Promise<void>;
  locale: ResolvedLocale;
  t: (k: TranslationKeys) => string;
}

const RULER_BOX_CSS_PX = 200;
const CARD_MIN_WIDTH_PX = 150;
const PHONE_MIN_WIDTH_PX = 150;
const CUSTOM_MIN_WIDTH_PX = 150;

const DESK_SIZE_PRESETS = [
  { id: 'sticky', labelKey: 'presetStickyNote' as const, mm: 76 },
  { id: 'passport', labelKey: 'presetPassport' as const, mm: 125 },
  { id: 'a5-short', labelKey: 'presetA5Short' as const, mm: 148 },
  { id: 'a4-short', labelKey: 'presetA4Short' as const, mm: 210 },
  { id: 'letter-short', labelKey: 'presetLetterShort' as const, mm: 216 },
  { id: 'a4-long', labelKey: 'presetA4Long' as const, mm: 297 },
] as const;

export function CalibrationModal({
  open,
  onClose,
  devices,
  monitorKey,
  currentProfile,
  allProfiles,
  onSaveProfile,
  onDeleteProfile,
  locale,
  t,
}: CalibrationModalProps) {
  const [tab, setTab] = useState<CalibrationMethod>('card');
  const [label, setLabel] = useState<string>('');
  const [cardWidthPx, setCardWidthPx] = useState<number>(320);
  const [measuredMm, setMeasuredMm] = useState<string>('55');
  const [refPhoneId, setRefPhoneId] = useState<string>('iphone-17');
  const [phoneEdge, setPhoneEdge] = useState<'width' | 'height'>('width');
  const [phoneSpanPx, setPhoneSpanPx] = useState<number>(270);
  const [customMmInput, setCustomMmInput] = useState<string>('100');
  const [customSpanPx, setCustomSpanPx] = useState<number>(380);
  const [selectedPresetInches, setSelectedPresetInches] = useState<number>(23.8);
  const [trackMaxPx, setTrackMaxPx] = useState<number>(960);
  const [profilesExpanded, setProfilesExpanded] = useState<boolean>(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const trackElRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    initialWidth: number;
    minW: number;
    maxW: number;
    setter: (next: number) => void;
  } | null>(null);

  useModalFocusTrap(open, dialogRef, onClose);

  const phoneDevices = useMemo(
    () => devices.filter((d) => !d.isCustom && d.category === 'phone'),
    [devices],
  );
  const tabletDevices = useMemo(
    () => devices.filter((d) => !d.isCustom && d.category === 'tablet'),
    [devices],
  );
  const customDevices = useMemo(() => devices.filter((d) => Boolean(d.isCustom)), [devices]);

  const refDevice = useMemo(
    () => devices.find((d) => d.id === refPhoneId) ?? devices[0],
    [devices, refPhoneId],
  );

  const refPhysicalMm = phoneEdge === 'width' ? refDevice.bodyWidthMm : refDevice.bodyHeightMm;
  const parsedCustomMm = Number(customMmInput);
  const isCustomMmValid =
    /^[1-9]\d*$/.test(customMmInput.trim()) &&
    Number.isInteger(parsedCustomMm) &&
    parsedCustomMm >= 20 &&
    parsedCustomMm <= 400;

  const parsedRulerMm = Number(measuredMm);
  const isRulerValid =
    /^[1-9]\d*$/.test(measuredMm.trim()) &&
    Number.isInteger(parsedRulerMm) &&
    parsedRulerMm >= 20 &&
    parsedRulerMm <= 150;

  const cardMaxPx = Math.max(CARD_MIN_WIDTH_PX + 60, trackMaxPx);
  const phoneMaxPx = Math.max(PHONE_MIN_WIDTH_PX + 60, trackMaxPx);
  const customMaxPx = Math.max(CUSTOM_MIN_WIDTH_PX + 60, trackMaxPx);

  // Measure horizontal track width strictly inside the dialog so handles never leave visible bounds
  useEffect(() => {
    if (!open || (tab !== 'card' && tab !== 'phone' && tab !== 'custom')) return;
    const el = trackElRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth <= 0) return;
      // Reserve space for padding (32px), left border (4px), right pill protrusion (12px) & shadow margin (16px)
      const next = Math.max(220, Math.floor(el.clientWidth - 64));
      setTrackMaxPx(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, tab]);

  // Clamp spans whenever viewport/track width shrinks so the right handle never overflows
  useEffect(() => {
    setCardWidthPx((w) => Math.min(cardMaxPx, Math.max(CARD_MIN_WIDTH_PX, w)));
    setPhoneSpanPx((w) => Math.min(phoneMaxPx, Math.max(PHONE_MIN_WIDTH_PX, w)));
    setCustomSpanPx((w) => Math.min(customMaxPx, Math.max(CUSTOM_MIN_WIDTH_PX, w)));
  }, [cardMaxPx, phoneMaxPx, customMaxPx]);

  // Initialize fields once whenever dialog opens
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const basePxPerMm = currentProfile?.cssPxPerMm ?? 3.8;
    setLabel(currentProfile?.label || monitorKey);
    const initCard = Math.round(basePxPerMm * ISO_CARD_WIDTH_MM * 2) / 2;
    setCardWidthPx(Math.min(cardMaxPx, Math.max(CARD_MIN_WIDTH_PX, initCard)));
    setMeasuredMm(String(Math.max(20, Math.min(150, Math.round(RULER_BOX_CSS_PX / basePxPerMm)))));
    setCustomSpanPx(Math.min(customMaxPx, Math.max(CUSTOM_MIN_WIDTH_PX, Math.round(100 * basePxPerMm))));
    if (currentProfile) {
      let bestPreset = DISPLAY_PRESETS[4].diagonalInches;
      let bestDiff = Infinity;
      for (const preset of DISPLAY_PRESETS) {
        const est = estimateCssPxPerMmFromPreset(
          window.screen.width,
          window.screen.height,
          preset.diagonalInches,
        );
        const diff = Math.abs(est - currentProfile.cssPxPerMm);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestPreset = preset.diagonalInches;
        }
      }
      setSelectedPresetInches(bestPreset);
    } else {
      setSelectedPresetInches(DISPLAY_PRESETS[4].diagonalInches);
    }
    setProfilesExpanded(Object.keys(allProfiles).length > 1);
  }, [open, currentProfile, monitorKey, cardMaxPx, customMaxPx, allProfiles]);

  // Reset phone span cleanly when user changes device or edge
  useEffect(() => {
    if (!open) return;
    const basePxPerMm = currentProfile?.cssPxPerMm ?? 3.8;
    const initialPhone = Math.round(refPhysicalMm * basePxPerMm * 2) / 2;
    setPhoneSpanPx(Math.min(phoneMaxPx, Math.max(PHONE_MIN_WIDTH_PX, initialPhone)));
  }, [open, refPhysicalMm, currentProfile?.cssPxPerMm, phoneMaxPx]);

  // Update custom span cleanly when user changes valid custom mm target
  useEffect(() => {
    if (!open || !isCustomMmValid) return;
    const basePxPerMm = currentProfile?.cssPxPerMm ?? 3.8;
    const initialCustom = Math.round(parsedCustomMm * basePxPerMm * 2) / 2;
    setCustomSpanPx(Math.min(customMaxPx, Math.max(CUSTOM_MIN_WIDTH_PX, initialCustom)));
  }, [open, isCustomMmValid, parsedCustomMm, currentProfile?.cssPxPerMm, customMaxPx]);

  if (!open) return null;

  const computedPxPerMm = (() => {
    switch (tab) {
      case 'card':
        return calcCssPxPerMmFromCard(cardWidthPx);
      case 'ruler':
        return calcCssPxPerMmFromRuler(RULER_BOX_CSS_PX, isRulerValid ? parsedRulerMm : 55);
      case 'phone':
        return calcCssPxPerMmFromSpan(phoneSpanPx, refPhysicalMm);
      case 'custom':
        return calcCssPxPerMmFromSpan(customSpanPx, isCustomMmValid ? parsedCustomMm : 100);
      case 'preset':
        return estimateCssPxPerMmFromPreset(
          window.screen.width,
          window.screen.height,
          selectedPresetInches,
        );
    }
  })();

  const isCurrentTabValid =
    (tab !== 'ruler' || isRulerValid) && (tab !== 'custom' || isCustomMmValid);

  const handleSave = async () => {
    if (!isCurrentTabValid) return;
    const profile: CalibrationProfile = {
      monitorKey,
      label: label.trim() || monitorKey,
      cssPxPerMm: computedPxPerMm,
      method: tab,
      isCalibrated: true,
      updatedAt: Date.now(),
    };
    await onSaveProfile(profile);
    onClose();
  };

  const handleApplySaved = async (profile: CalibrationProfile) => {
    await onSaveProfile({
      ...profile,
      monitorKey,
      updatedAt: Date.now(),
    });
    onClose();
  };

  const onHandlePointerDown =
    (initialWidth: number, minW: number, maxW: number, setter: (next: number) => void) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        initialWidth,
        minW,
        maxW,
        setter,
      };
    };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const delta = e.clientX - drag.startX;
    const clamped = Math.min(
      drag.maxW,
      Math.max(drag.minW, Math.round((drag.initialWidth + delta) * 2) / 2),
    );
    drag.setter(clamped);
  };

  const onHandlePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
  };

  const savedList = Object.values(allProfiles).sort((a, b) => b.updatedAt - a.updatedAt);
  const hasUnsavedDiff = !currentProfile || Math.abs(computedPxPerMm - currentProfile.cssPxPerMm) > 0.005;
  const desiredPhoneSpanPx = refPhysicalMm * (currentProfile?.cssPxPerMm ?? 3.8);
  const isPhoneWidthCapped = desiredPhoneSpanPx > phoneMaxPx;
  const desiredCustomSpanPx =
    (isCustomMmValid ? parsedCustomMm : 100) * (currentProfile?.cssPxPerMm ?? 3.8);
  const isCustomWidthCapped = desiredCustomSpanPx > customMaxPx;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-cal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md dark:bg-black/70"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-[min(94vw,1380px)] flex-col rounded-3xl border border-black/[0.08] bg-white p-6 text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        {/* Fixed Header */}
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h2 id="ts-cal-title" className="text-lg font-semibold tracking-tight">
              {t('calibrationTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-[#6E6E73] dark:text-[#98989D]">
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {t('calibrationPrivacyReason')}
              </span>
              {t('calibrationPrivacyReason').endsWith('。') ? '' : ' '}
              {t('calibrationDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="cursor-pointer rounded-full bg-black/[0.05] p-1.5 text-[#6E6E73] transition hover:bg-black/10 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:bg-white/10 dark:text-[#98989D] dark:hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* Display Name & Monitor Key */}
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-3.5 sm:grid-cols-2 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
            <div>
              <label
                htmlFor="ts-cal-label"
                className="mb-1 block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
              >
                {t('monitorLabelInput')}
              </label>
              <input
                id="ts-cal-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
              />
            </div>
            <div className="flex flex-col justify-end text-xs">
              <span className="mb-1 text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                {t('livePreviewLabel')}
              </span>
              <div
                dir="ltr"
                className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-1.5 font-mono text-xs text-[#0066D6] dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#64D2FF]"
              >
                <span>{monitorKey}</span>
                <div className="flex items-center gap-1.5">
                  {hasUnsavedDiff && (
                    <span
                      dir={locale === 'ar' ? 'rtl' : 'ltr'}
                      className="rounded-full bg-[#007AFF]/12 px-2 py-0.5 font-sans text-xs font-medium text-[#0066D6] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]"
                    >
                      {t('unsavedPreviewBadge')}
                    </span>
                  )}
                  <span
                    className={`font-semibold ${
                      hasUnsavedDiff
                        ? 'text-[#0066D6] dark:text-[#64D2FF]'
                        : 'text-[#248A3D] dark:text-[#30D158]'
                    }`}
                  >
                    {computedPxPerMm.toFixed(3)} px/mm
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Calibration Method Tabs */}
          <div
            role="tablist"
            className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#E5E5EA]/70 p-1 sm:grid-cols-5 dark:bg-[#2C2C2E]"
          >
            {(
              [
                { id: 'card', icon: CreditCard, label: t('tabCard') },
                { id: 'phone', icon: Smartphone, label: t('tabPhone') },
                { id: 'custom', icon: SlidersHorizontal, label: t('tabCustom') },
                { id: 'ruler', icon: Ruler, label: t('tabRuler') },
                { id: 'preset', icon: Monitor, label: t('tabPreset') },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
                    active
                      ? 'bg-white text-[#1D1D1F] shadow-sm dark:bg-[#0A84FF] dark:text-white'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Left-Anchored Fixed-Height Card Caliper (Only Right Vertical Guide Moves) */}
          {tab === 'card' && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
                {t('cardInstruction')}
              </p>
              <div
                ref={trackElRef}
                dir="ltr"
                className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-4 dark:border-white/[0.1] dark:bg-[#1C1C1E]"
              >
                <div className="mb-2 flex justify-end text-xs font-medium">
                  <span className="font-mono text-[#6E6E73] dark:text-[#98989D]">
                    {cardWidthPx.toFixed(1)} CSS px = 85.60 mm
                  </span>
                </div>

                <div className="relative flex justify-start border-l-4 border-[#007AFF] bg-black/[0.02] py-3.5 dark:border-[#0A84FF] dark:bg-white/[0.03]">
                  {/* Faint static horizontal bank card schematic indicating orientation only */}
                  <div className="pointer-events-none absolute left-0 top-3.5 h-[144px] w-[228px] select-none overflow-hidden rounded-r-2xl border border-dashed border-[#007AFF]/35 opacity-60 dark:border-[#0A84FF]/40">
                    <svg
                      viewBox="0 0 228 144"
                      aria-hidden="true"
                      className="block h-full w-full"
                    >
                      <defs>
                        <linearGradient id="tsCardGradStatic" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#007AFF" stopOpacity="0.11" />
                          <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.12" />
                        </linearGradient>
                      </defs>
                      <rect x="0" y="0" width="228" height="144" fill="url(#tsCardGradStatic)" />
                      <rect
                        x="18"
                        y="56"
                        width="32"
                        height="24"
                        rx="5"
                        fill="#F59E0B"
                        fillOpacity="0.38"
                        stroke="#D97706"
                        strokeOpacity="0.45"
                        strokeWidth="1.2"
                      />
                      <line x1="18" y1="68" x2="50" y2="68" stroke="#D97706" strokeOpacity="0.35" />
                      <line x1="34" y1="56" x2="34" y2="80" stroke="#D97706" strokeOpacity="0.35" />
                      <text
                        x="18"
                        y="24"
                        fill="#0066D6"
                        fillOpacity="0.72"
                        fontSize="12"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                      >
                        ISO/IEC 7810 ID-1
                      </text>
                      <text
                        x="18"
                        y="41"
                        fill="#0066D6"
                        fillOpacity="0.6"
                        fontSize="12"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="500"
                      >
                        85.60 × 53.98 mm
                      </text>
                      <text
                        x="18"
                        y="114"
                        fill="#1D1D1F"
                        fillOpacity="0.3"
                        fontSize="12"
                        fontFamily="ui-monospace, monospace"
                        letterSpacing="1.5"
                      >
                        •••• •••• •••• 8560
                      </text>
                    </svg>
                  </div>

                  {/* Movable horizontal span with vertical dashed right alignment guide only */}
                  <div
                    style={{ width: `${cardWidthPx}px` }}
                    className="relative z-10 h-[144px] shrink-0 border-r-2 border-dashed border-[#007AFF] bg-[#007AFF]/[0.06] select-none dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.1]"
                  >
                    <button
                      type="button"
                      aria-label={t('dragRightBadge')}
                      title={t('dragRightBadge')}
                      onPointerDown={onHandlePointerDown(
                        cardWidthPx,
                        CARD_MIN_WIDTH_PX,
                        cardMaxPx,
                        setCardWidthPx,
                      )}
                      onPointerMove={onHandlePointerMove}
                      onPointerUp={onHandlePointerEnd}
                      onPointerCancel={onHandlePointerEnd}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          setCardWidthPx((w) => Math.max(CARD_MIN_WIDTH_PX, Number((w - 1).toFixed(1))));
                        } else if (e.key === 'ArrowRight') {
                          e.preventDefault();
                          setCardWidthPx((w) => Math.min(cardMaxPx, Number((w + 1).toFixed(1))));
                        }
                      }}
                      style={{ touchAction: 'none' }}
                      className="absolute -right-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-[#007AFF] text-xs font-bold text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 dark:bg-[#0A84FF]"
                    >
                      ↔
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Measure Square Side Length (Strictly Positive Integer mm) */}
          {tab === 'ruler' && (
            <div className="space-y-3">
              <p className="text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">{t('rulerInstruction')}</p>
              <div className="flex flex-col items-center gap-6 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-5 sm:flex-row sm:justify-around dark:border-white/[0.1] dark:bg-[#2C2C2E]">
                <div
                  style={{ width: `${RULER_BOX_CSS_PX}px`, height: `${RULER_BOX_CSS_PX}px` }}
                  className="flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[#007AFF] bg-[#007AFF]/12 text-center dark:border-[#0A84FF]"
                >
                  <span className="font-mono text-sm font-bold text-[#0066D6] dark:text-[#64D2FF]">
                    {RULER_BOX_CSS_PX} × {RULER_BOX_CSS_PX}
                  </span>
                  <span className="mt-1 text-xs text-[#007AFF] dark:text-[#64D2FF]">CSS px</span>
                </div>

                <div className="w-full max-w-xs space-y-2.5">
                  <div>
                    <label
                      htmlFor="ts-ruler-mm"
                      className="mb-1.5 block text-xs font-medium text-[#3A3A3C] dark:text-[#E5E5EA]"
                    >
                      {t('rulerMeasuredMm')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="ts-ruler-mm"
                        type="text"
                        inputMode="numeric"
                        value={measuredMm}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '');
                          setMeasuredMm(digitsOnly);
                        }}
                        placeholder="55"
                        aria-invalid={!isRulerValid}
                        className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-[#1D1D1F] outline-none dark:bg-[#1C1C1E] dark:text-[#F5F5F7] ${
                          isRulerValid
                            ? 'border-black/10 focus:border-[#007AFF] dark:border-white/[0.12]'
                            : 'border-rose-500 focus:border-rose-500'
                        }`}
                      />
                      <span className="shrink-0 font-mono text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">
                        mm
                      </span>
                    </div>
                  </div>
                  {!isRulerValid ? (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {t('rulerInvalidError')}
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
                      {t('rulerRangeHint')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Left-Anchored Real Device Outer Body Caliper (Synced Device List, No Emoji, Handle Only) */}
          {tab === 'phone' && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
                {t('phoneInstruction')}
              </p>
              <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-4 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="ts-ref-phone"
                      className="mb-1 block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                    >
                      {t('phoneDeviceLabel')}
                    </label>
                    <select
                      id="ts-ref-phone"
                      value={refDevice.id}
                      onChange={(e) => setRefPhoneId(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
                    >
                      <optgroup label={t('phonesGroup')}>
                        {phoneDevices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.diagonalInches}&quot;)
                          </option>
                        ))}
                      </optgroup>
                      {tabletDevices.length > 0 && (
                        <optgroup label={t('tabletsGroup')}>
                          {tabletDevices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.diagonalInches}&quot;)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {customDevices.length > 0 && (
                        <optgroup label={t('customGroup')}>
                          {customDevices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.diagonalInches}&quot;)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                      {t('phoneEdgeSelect')}
                    </label>
                    <div className="grid grid-cols-2 rounded-xl bg-black/[0.06] p-0.5 text-xs dark:bg-[#1C1C1E]">
                      <button
                        type="button"
                        onClick={() => setPhoneEdge('width')}
                        className={`cursor-pointer rounded-lg px-2 py-1.5 font-medium transition ${
                          phoneEdge === 'width'
                            ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#0A84FF] dark:text-white'
                            : 'text-[#6E6E73] dark:text-[#98989D]'
                        }`}
                      >
                        {t('phoneEdgeWidth')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhoneEdge('height')}
                        className={`cursor-pointer rounded-lg px-2 py-1.5 font-medium transition ${
                          phoneEdge === 'height'
                            ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#0A84FF] dark:text-white'
                            : 'text-[#6E6E73] dark:text-[#98989D]'
                        }`}
                      >
                        {t('phoneEdgeHeight')}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  ref={trackElRef}
                  dir="ltr"
                  className="overflow-hidden rounded-xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.1] dark:bg-[#1C1C1E]"
                >
                  <div className="mb-2 flex justify-end text-xs font-medium">
                    <span className="font-mono text-[#3A3A3C] dark:text-[#E5E5EA]">
                      {refDevice.name} · {refPhysicalMm.toFixed(1)} mm ↔ {phoneSpanPx.toFixed(1)} CSS px
                    </span>
                  </div>

                  <div className="relative flex justify-start border-l-4 border-[#007AFF] bg-black/[0.02] py-3 dark:border-[#0A84FF] dark:bg-white/[0.03]">
                    <div
                      style={{ width: `${phoneSpanPx}px` }}
                      className="relative flex h-24 shrink-0 flex-col items-center justify-center border-y border-r-2 border-dashed border-[#007AFF] bg-[#007AFF]/10 px-3 text-center select-none dark:border-[#0A84FF]"
                    >
                      <span className="text-xs font-semibold text-[#0066D6] dark:text-[#64D2FF]">
                        {refPhysicalMm.toFixed(1)} mm
                      </span>
                      <span className="mt-1 font-mono text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">
                        {phoneSpanPx.toFixed(1)} CSS px
                      </span>
                      <button
                        type="button"
                        aria-label={t('dragRightBadge')}
                        title={t('dragRightBadge')}
                        onPointerDown={onHandlePointerDown(
                          phoneSpanPx,
                          PHONE_MIN_WIDTH_PX,
                          phoneMaxPx,
                          setPhoneSpanPx,
                        )}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerEnd}
                        onPointerCancel={onHandlePointerEnd}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            setPhoneSpanPx((w) =>
                              Math.max(PHONE_MIN_WIDTH_PX, Number((w - 1).toFixed(1))),
                            );
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            setPhoneSpanPx((w) => Math.min(phoneMaxPx, Number((w + 1).toFixed(1))));
                          }
                        }}
                        style={{ touchAction: 'none' }}
                        className="absolute -right-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-[#007AFF] text-xs font-bold text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 dark:bg-[#0A84FF]"
                      >
                        ↔
                      </button>
                    </div>
                  </div>

                  {isPhoneWidthCapped && (
                    <p className="mt-2.5 text-xs text-amber-700 dark:text-amber-400">
                      {t('phoneWidthLimitHint')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Custom Positive Integer Millimeter Alignment */}
          {tab === 'custom' && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-[#3A3A3C] dark:text-[#E5E5EA]">
                {t('customInstruction')}
              </p>
              <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-4 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,310px)_1fr] lg:items-start">
                  <div>
                    <label
                      htmlFor="ts-custom-mm"
                      className="mb-1.5 block text-xs font-medium text-[#6E6E73] dark:text-[#98989D]"
                    >
                      {t('customMmLabel')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="ts-custom-mm"
                        type="text"
                        inputMode="numeric"
                        value={customMmInput}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '');
                          setCustomMmInput(digitsOnly);
                        }}
                        placeholder="100"
                        aria-invalid={!isCustomMmValid}
                        className={`w-36 rounded-xl border bg-white px-3 py-2 text-xs text-[#1D1D1F] outline-none dark:bg-[#1C1C1E] dark:text-[#F5F5F7] ${
                          isCustomMmValid
                            ? 'border-black/10 focus:border-[#007AFF] dark:border-white/[0.12]'
                            : 'border-rose-500 focus:border-rose-500'
                        }`}
                      />
                      <span className="shrink-0 font-mono text-xs font-semibold text-[#6E6E73] dark:text-[#98989D]">
                        mm
                      </span>
                    </div>
                    {!isCustomMmValid ? (
                      <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                        {t('customInvalidError')}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
                        {t('customRangeHint')}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                      {t('customPresetsTitle')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DESK_SIZE_PRESETS.map((item) => {
                        const active = isCustomMmValid && parsedCustomMm === item.mm;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCustomMmInput(String(item.mm))}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
                              active
                                ? 'border-[#007AFF] bg-[#007AFF]/12 font-semibold text-[#0066D6] dark:border-[#0A84FF] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]'
                                : 'border-black/10 bg-white text-[#1D1D1F] hover:border-black/20 hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]'
                            }`}
                          >
                            <span>{t(item.labelKey)}</span>
                            <span
                              dir="ltr"
                              className="font-mono text-xs text-[#6E6E73] dark:text-[#98989D]"
                            >
                              {item.mm} mm
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div
                  ref={trackElRef}
                  dir="ltr"
                  className="overflow-hidden rounded-xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.1] dark:bg-[#1C1C1E]"
                >
                  <div className="mb-2 flex justify-end text-xs font-medium">
                    <span className="font-mono text-[#3A3A3C] dark:text-[#E5E5EA]">
                      {isCustomMmValid ? parsedCustomMm : '--'} mm ↔ {customSpanPx.toFixed(1)} CSS px
                    </span>
                  </div>

                  <div className="relative flex justify-start border-l-4 border-[#007AFF] bg-black/[0.02] py-3 dark:border-[#0A84FF] dark:bg-white/[0.03]">
                    <div
                      style={{ width: `${customSpanPx}px` }}
                      className="relative flex h-24 shrink-0 flex-col items-center justify-center border-y border-r-2 border-dashed border-[#007AFF] bg-[#007AFF]/10 px-3 text-center select-none dark:border-[#0A84FF]"
                    >
                      <span className="text-xs font-semibold text-[#0066D6] dark:text-[#64D2FF]">
                        {isCustomMmValid ? `${parsedCustomMm} mm` : '-- mm'}
                      </span>
                      <span className="mt-1 font-mono text-xs text-[#3A3A3C] dark:text-[#E5E5EA]">
                        {customSpanPx.toFixed(1)} CSS px
                      </span>
                      <button
                        type="button"
                        aria-label={t('dragRightBadge')}
                        title={t('dragRightBadge')}
                        onPointerDown={onHandlePointerDown(
                          customSpanPx,
                          CUSTOM_MIN_WIDTH_PX,
                          customMaxPx,
                          setCustomSpanPx,
                        )}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerEnd}
                        onPointerCancel={onHandlePointerEnd}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            setCustomSpanPx((w) =>
                              Math.max(CUSTOM_MIN_WIDTH_PX, Number((w - 1).toFixed(1))),
                            );
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            setCustomSpanPx((w) =>
                              Math.min(customMaxPx, Number((w + 1).toFixed(1))),
                            );
                          }
                        }}
                        style={{ touchAction: 'none' }}
                        className="absolute -right-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-[#007AFF] text-xs font-bold text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 dark:bg-[#0A84FF]"
                      >
                        ↔
                      </button>
                    </div>
                  </div>

                  {isCustomWidthCapped && (
                    <p className="mt-2.5 text-xs text-amber-700 dark:text-amber-400">
                      {t('customWidthLimitHint')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Quick Monitor Diagonal Preset */}
          {tab === 'preset' && (
            <div className="space-y-3">
              <div className="space-y-1 text-xs">
                <p className="text-[#3A3A3C] dark:text-[#E5E5EA]">{t('presetInstruction')}</p>
                <p className="font-semibold text-rose-600 dark:text-rose-400">
                  {t('presetAccuracyWarning')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-black/[0.08] bg-[#F5F5F7] p-4 sm:grid-cols-4 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
                {DISPLAY_PRESETS.map((preset) => {
                  const active = selectedPresetInches === preset.diagonalInches;
                  const estPxPerMm = estimateCssPxPerMmFromPreset(
                    window.screen.width,
                    window.screen.height,
                    preset.diagonalInches,
                  );
                  const displayInch =
                    preset.id === 'monitor-24' ? 24 : preset.id === 'monitor-32' ? 32 : preset.diagonalInches;
                  const presetTitle =
                    locale === 'zh_CN'
                      ? preset.labelZh
                      : locale === 'en'
                        ? preset.labelEn
                        : `${displayInch}" ${t(preset.id.startsWith('laptop-') ? 'presetLaptopUnit' : 'presetMonitorUnit')}`;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetInches(preset.diagonalInches)}
                      className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-start transition ${
                        active
                          ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#0066D6] dark:border-[#0A84FF] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]'
                          : 'border-black/[0.08] bg-white text-[#1D1D1F] hover:border-black/20 dark:border-white/[0.1] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]'
                      }`}
                    >
                      <span className="text-xs font-semibold">{presetTitle}</span>
                      <span dir="ltr" className="mt-1 font-mono text-xs text-[#6E6E73] dark:text-[#98989D]">
                        ~{estPxPerMm.toFixed(2)} px/mm
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible Saved Monitor Profiles (Auto-expanded for Multi-Monitor Setups) */}
          <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] px-3.5 py-2.5 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
            <button
              type="button"
              onClick={() => setProfilesExpanded((prev) => !prev)}
              aria-expanded={profilesExpanded}
              className="flex w-full cursor-pointer items-center justify-between gap-2 text-start text-xs"
            >
              <span className="font-semibold tracking-wider text-[#6E6E73] uppercase dark:text-[#98989D]">
                {t('savedProfiles')} ({savedList.length})
              </span>
              <div className="flex items-center gap-2">
                {!profilesExpanded && currentProfile && (
                  <span dir="ltr" className="font-mono text-xs font-medium text-[#248A3D] dark:text-[#30D158]">
                    {currentProfile.monitorKey} · {currentProfile.cssPxPerMm.toFixed(2)} px/mm
                  </span>
                )}
                {profilesExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
                )}
              </div>
            </button>

            {profilesExpanded && (
              <div className="mt-2.5">
                {savedList.length === 0 ? (
                  <p className="text-xs text-[#86868B] dark:text-[#8E8E93]">{t('noSavedProfiles')}</p>
                ) : (
                  <div className="max-h-28 space-y-1.5 overflow-y-auto">
                    {savedList.map((item) => (
                      <div
                        key={item.monitorKey}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-1.5 text-xs dark:border-white/[0.1] dark:bg-[#1C1C1E]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {item.label}
                          </span>
                          {item.label !== item.monitorKey && (
                            <span dir="ltr" className="font-mono text-xs text-[#86868B] dark:text-[#98989D]">
                              {item.monitorKey}
                            </span>
                          )}
                          {item.method === 'preset' && (
                            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-[#6E6E73] dark:text-[#98989D]">
                              {t('estimatedBadge')}
                            </span>
                          )}
                          {item.monitorKey === monitorKey && (
                            <span className="rounded-full bg-[#34C759]/15 px-2 py-0.5 text-xs font-medium text-[#248A3D] dark:bg-[#30D158]/20 dark:text-[#30D158]">
                              {t('savedActiveBadge')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span dir="ltr" className="font-mono font-medium text-[#248A3D] dark:text-[#30D158]">
                            {item.cssPxPerMm.toFixed(2)} px/mm
                          </span>
                          {item.monitorKey !== monitorKey && (
                            <button
                              type="button"
                              onClick={() => void handleApplySaved(item)}
                              className="cursor-pointer rounded-lg border border-[#007AFF]/35 bg-[#007AFF]/10 px-2 py-0.5 text-xs font-medium text-[#0066D6] hover:bg-[#007AFF]/20 dark:text-[#64D2FF]"
                            >
                              {t('applySavedProfile')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDeleteProfile(item.monitorKey)}
                            aria-label={t('deleteProfile')}
                            className="cursor-pointer text-[#86868B] hover:text-rose-500"
                            title={t('deleteProfile')}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!isCurrentTabValid}
            onClick={() => void handleSave()}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0A84FF]"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('saveCalibration')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
