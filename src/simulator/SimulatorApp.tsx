import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PRESET_DEVICES } from '../config/devices';
import { createTranslator } from '../shared/i18n';
import {
  DEFAULT_FALLBACK_CSS_PX_PER_MM,
  calcTrueScaleFactor,
  getMonitorKey,
} from '../shared/scale';
import {
  DEFAULT_SETTINGS,
  clearCalibrationProfiles,
  deleteCalibrationProfile,
  deleteCustomDevice,
  getCalibrationProfiles,
  getCustomDevices,
  getSettings,
  resetAllPluginData,
  saveCalibrationProfile,
  saveCustomDevice,
  saveSettings,
} from '../shared/storage';
import type {
  CalibrationProfile,
  DeviceProfile,
  Orientation,
  RuntimeRequest,
  RuntimeResponse,
  UserSettings,
  ViewScaleMode,
} from '../shared/types';
import { CalibrationModal } from './components/CalibrationModal';
import { CustomDeviceModal } from './components/CustomDeviceModal';
import { DeviceStage } from './components/DeviceStage';
import { FeatureGuideOverlay } from './components/FeatureGuideOverlay';
import { QuickNavDock } from './components/QuickNavDock';
import { RightStagePanel } from './components/RightStagePanel';
import { ScreenshotPreviewModal } from './components/ScreenshotPreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { SideTipsStack } from './components/SideTipsStack';
import { SponsorModal } from './components/SponsorModal';
import { Toolbar } from './components/Toolbar';
import {
  type CaptureKind,
  type CaptureProgressInfo,
  captureFullPageSnapshot,
  captureScreenSnapshot,
  captureTransparentFramedSnapshot,
} from './utils/screenshot';

export interface SimulatorAppProps {
  inPlace?: boolean;
  initialDeviceId?: string;
  initialOpenCalibration?: boolean;
  onExitInPlace?: () => void;
}

function defaultOrientationForDevice(device?: DeviceProfile): Orientation {
  return device?.category === 'tablet' ? 'landscape' : 'portrait';
}

export function SimulatorApp({
  initialDeviceId,
  initialOpenCalibration = false,
  onExitInPlace,
}: SimulatorAppProps) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [customDevices, setCustomDevices] = useState<DeviceProfile[]>([]);
  const [calibrations, setCalibrations] = useState<Record<string, CalibrationProfile>>({});

  const targetUrl = window.location.href;
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => initialDeviceId || DEFAULT_SETTINGS.defaultDeviceId,
  );

  const [orientation, setOrientation] = useState<Orientation>(() => {
    const startId = initialDeviceId || DEFAULT_SETTINGS.defaultDeviceId;
    return defaultOrientationForDevice(PRESET_DEVICES.find((d) => d.id === startId));
  });
  const [showFrame, setShowFrame] = useState<boolean>(true);
  const [showBrowserBars, setShowBrowserBars] = useState<boolean>(true);
  const [showSafeArea, setShowSafeArea] = useState<boolean>(false);
  const [scaleMode, setScaleMode] = useState<ViewScaleMode>('true-size');
  const [reloadKey, setReloadKey] = useState<number>(1);
  const [rulesReady, setRulesReady] = useState<boolean>(true);

  const [tabId, setTabId] = useState<number | null>(null);
  const [tabLookupDone, setTabLookupDone] = useState<boolean>(false);
  const [windowId, setWindowId] = useState<number | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const [screenTick, setScreenTick] = useState<number>(0);

  const [calibrationOpen, setCalibrationOpen] = useState<boolean>(() =>
    Boolean(initialOpenCalibration),
  );
  const [customDeviceOpen, setCustomDeviceOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [sponsorOpen, setSponsorOpen] = useState<boolean>(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [leftTipsUserCollapsed, setLeftTipsUserCollapsed] = useState<boolean | null>(null);
  const [rightSpecsUserCollapsed, setRightSpecsUserCollapsed] = useState<boolean | null>(null);

  const [captureScaleOverride, setCaptureScaleOverride] = useState<number | null>(null);
  const [captureState, setCaptureState] = useState<{
    isLong: boolean;
    percent: number;
    currentSlice: number;
    totalSlices: number;
  } | null>(null);
  const [previewCapture, setPreviewCapture] = useState<{
    canvas: HTMLCanvasElement;
    filenameBase: string;
    dpi: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const screenSurfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const captureAbortRef = useRef<AbortController | null>(null);

  const monitorKey = useMemo(() => {
    void screenTick;
    return getMonitorKey(window.screen.width, window.screen.height, window.devicePixelRatio || 1);
  }, [screenTick]);

  const allDevices = useMemo(() => [...PRESET_DEVICES, ...customDevices], [customDevices]);
  const activeDevice = useMemo(
    () => allDevices.find((d) => d.id === selectedDeviceId) ?? PRESET_DEVICES[0],
    [allDevices, selectedDeviceId],
  );

  const isDark = useMemo(() => {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'auto') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
    return false;
  }, [settings.theme]);

  const { locale, isRtl, t } = useMemo(() => createTranslator(settings.language), [settings.language]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  const lastAppliedInitialIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (initialDeviceId && lastAppliedInitialIdRef.current !== initialDeviceId) {
      lastAppliedInitialIdRef.current = initialDeviceId;
      setSelectedDeviceId(initialDeviceId);
      const matched = allDevices.find((d) => d.id === initialDeviceId);
      if (matched) {
        setOrientation(defaultOrientationForDevice(matched));
      }
    }
  }, [initialDeviceId, allDevices]);

  useEffect(() => {
    if (initialOpenCalibration) {
      setCalibrationOpen(true);
    }
  }, [initialOpenCalibration]);

  useEffect(() => {
    const onResize = () => setScreenTick((c) => c + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedCustom, loadedCalibrations] = await Promise.all([
        getSettings(),
        getCustomDevices(),
        getCalibrationProfiles(),
      ]);
      setSettings(loadedSettings);
      setCustomDevices(loadedCustom);
      setCalibrations(loadedCalibrations);
      setShowFrame(loadedSettings.defaultShowFrame);
      setShowBrowserBars(loadedSettings.defaultShowBrowserBars);
      setShowSafeArea(Boolean(loadedSettings.showSafeArea));
      const resolvedId = initialDeviceId || loadedSettings.defaultDeviceId;
      const allLoaded = [...PRESET_DEVICES, ...loadedCustom];
      const resolvedDev = allLoaded.find((d) => d.id === resolvedId) ?? PRESET_DEVICES[0];
      if (!initialDeviceId) {
        setSelectedDeviceId(loadedSettings.defaultDeviceId);
      }
      setOrientation(defaultOrientationForDevice(resolvedDev));
      if (!loadedSettings.hasSeenGuide && !initialOpenCalibration) {
        setGuideOpen(true);
      }

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = (await chrome.runtime.sendMessage({
          type: 'GET_TAB_INFO',
        } satisfies RuntimeRequest)) as RuntimeResponse<{
          tabId: number | null;
          windowId: number | null;
        }>;
        if (res?.ok && res.data) {
          setTabId(res.data.tabId);
          setWindowId(res.data.windowId);
        }
      }
      setTabLookupDone(true);
    })();
  }, [initialDeviceId]);

  const triggerTopReloadWithoutSim = useCallback(() => {
    if (tabId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      void chrome.runtime
        .sendMessage({ type: 'DEACTIVATE_INPLACE', tabId } satisfies RuntimeRequest)
        .finally(() => window.location.reload());
      return;
    }
    onExitInPlace?.();
    window.location.reload();
  }, [tabId, onExitInPlace]);

  // Block accidental Ctrl/Cmd + wheel or +/- zoom; browser F5/Ctrl+R cancels simulation and reloads cleanly
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (!captureState && (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r'))) {
        e.preventDefault();
        e.stopPropagation();
        triggerTopReloadWithoutSim();
      }
    };
    const onMsg = (event: MessageEvent) => {
      if (event.source === iframeRef.current?.contentWindow && event.data?.type === 'TS_REQUEST_TOP_RELOAD') {
        triggerTopReloadWithoutSim();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('message', onMsg);
    };
  }, [captureState, triggerTopReloadWithoutSim]);

  // Lock keyboard shortcuts & allow Escape to abort during screenshot capture
  useEffect(() => {
    if (!captureState) return;
    const onCaptureKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        captureAbortRef.current?.abort();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onCaptureKeyDown, true);
    return () => window.removeEventListener('keydown', onCaptureKeyDown, true);
  }, [captureState !== null]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateSize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setStageSize({ w, h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const firstMountRulesDone = useRef(false);

  useEffect(() => {
    if (!tabLookupDone || !tabId) return;
    if (!firstMountRulesDone.current) {
      firstMountRulesDone.current = true;
      setRulesReady(true);
      return;
    }
    let cancelled = false;
    setRulesReady(false);
    (async () => {
      try {
        const req: RuntimeRequest = {
          type: 'APPLY_SIMULATOR_RULES',
          tabId,
          device: activeDevice,
        };
        await chrome.runtime.sendMessage(req);
      } finally {
        if (!cancelled) {
          setRulesReady(true);
          setReloadKey((k) => k + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tabLookupDone, tabId, activeDevice]);

  const currentCalibration = calibrations[monitorKey];
  const cssPxPerMm = currentCalibration?.cssPxPerMm ?? DEFAULT_FALLBACK_CSS_PX_PER_MM;

  const metrics = useMemo(
    () => calcTrueScaleFactor(activeDevice, cssPxPerMm, orientation),
    [activeDevice, cssPxPerMm, orientation],
  );

  const effectiveScale = useMemo(() => {
    if (captureScaleOverride !== null) return captureScaleOverride;
    if (scaleMode === 'pixel-crisp') return 1;
    if (scaleMode === 'true-size') return metrics.scale;
    const bezelPad = showFrame ? activeDevice.bezel.bezelWidth * 2 : 0;
    const availW = Math.max(220, stageSize.w - 136);
    const availH = Math.max(260, stageSize.h - (stageSize.w < 860 ? 80 : 40));
    const fitW = availW / (metrics.viewportWidthPx + bezelPad);
    const fitH = availH / (metrics.viewportHeightPx + bezelPad);
    return Math.min(1.6, fitW, fitH);
  }, [captureScaleOverride, scaleMode, metrics, showFrame, activeDevice.bezel.bezelWidth, stageSize]);

  const handleUpdateSettings = async (patch: Partial<UserSettings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
  };

  const handleSaveProfile = async (profile: CalibrationProfile) => {
    const next = await saveCalibrationProfile(profile);
    setCalibrations(next);
  };

  const handleDeleteProfile = async (key: string) => {
    const next = await deleteCalibrationProfile(key);
    setCalibrations(next);
  };

  const handleResetCalibration = async () => {
    const next = await clearCalibrationProfiles();
    setCalibrations(next);
    showToast(t('resetCalibrationDone'));
  };

  const handleResetPlugin = async () => {
    await resetAllPluginData();
    setSettings(DEFAULT_SETTINGS);
    setCalibrations({});
    setCustomDevices([]);
    const resetDev = PRESET_DEVICES[0];
    setSelectedDeviceId(resetDev.id);
    setOrientation(defaultOrientationForDevice(resetDev));
    setScaleMode('true-size');
    setShowFrame(DEFAULT_SETTINGS.defaultShowFrame);
    setShowBrowserBars(DEFAULT_SETTINGS.defaultShowBrowserBars);
    setShowSafeArea(DEFAULT_SETTINGS.showSafeArea);
    setLeftTipsUserCollapsed(null);
    setRightSpecsUserCollapsed(null);
    setSettingsOpen(false);
    setGuideOpen(true);
    setReloadKey((k) => k + 1);
    showToast(t('resetPluginDone'));
  };

  const handleCloseGuide = () => {
    setGuideOpen(false);
    if (!settings.hasSeenGuide) {
      void handleUpdateSettings({ hasSeenGuide: true });
    }
  };

  const handleSaveCustomDevice = async (device: DeviceProfile) => {
    const next = await saveCustomDevice(device);
    setCustomDevices(next);
    setSelectedDeviceId(device.id);
    setOrientation(defaultOrientationForDevice(device));
    await handleUpdateSettings({ defaultDeviceId: device.id });
  };

  const handleDeleteCustomDevice = async (deviceId: string) => {
    const next = await deleteCustomDevice(deviceId);
    setCustomDevices(next);
    if (selectedDeviceId === deviceId) {
      setSelectedDeviceId(PRESET_DEVICES[0].id);
      setOrientation(defaultOrientationForDevice(PRESET_DEVICES[0]));
    }
  };

  const handleChangeScaleMode = (nextMode: ViewScaleMode) => {
    setScaleMode(nextMode);
    setLeftTipsUserCollapsed(null);
    setRightSpecsUserCollapsed(null);
  };

  const handleReloadViewport = useCallback(async () => {
    if (tabId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime
        .sendMessage({
          type: 'APPLY_SIMULATOR_RULES',
          tabId,
          device: activeDevice,
        } satisfies RuntimeRequest)
        .catch(() => {});
    }

    const frameWin = iframeRef.current?.contentWindow;
    if (frameWin) {
      const reqId = `ts-reload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const acked = await new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMsg);
          resolve(false);
        }, 250);

        const onMsg = (event: MessageEvent) => {
          if (
            event.source === frameWin &&
            event.data?.type === 'TS_MSG_REPLY' &&
            event.data?.reqId === reqId
          ) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            window.removeEventListener('message', onMsg);
            resolve(true);
          }
        };

        window.addEventListener('message', onMsg);
        frameWin.postMessage({ type: 'TS_MSG_RELOAD_VIEWPORT', reqId }, '*');
      });

      if (acked) {
        return;
      }

      try {
        frameWin.location.reload();
        return;
      } catch {
        // Cross-origin frame without active bridge falls back to remounting iframe
      }
    }

    setReloadKey((k) => k + 1);
  }, [tabId, activeDevice]);

  const handleNavHistory = useCallback((delta: -1 | 1) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'TS_MSG_NAV_HISTORY', delta },
      '*',
    );
  }, []);

  const handleScrollEdge = useCallback((edge: 'top' | 'bottom') => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'TS_MSG_SCROLL_EDGE', edge },
      '*',
    );
  }, []);

  const bezelPadForLayout = showFrame ? activeDevice.bezel.bezelWidth * 2 : 0;
  const scaledOuterWForLayout = (metrics.viewportWidthPx + bezelPadForLayout) * effectiveScale;
  const sideClearance = Math.floor((stageSize.w - scaledOuterWForLayout) / 2);
  const leftTipsCollapsed = leftTipsUserCollapsed ?? sideClearance < 300;
  const rightSpecsCollapsed = rightSpecsUserCollapsed ?? sideClearance < 390;

  const handleCapture = async (kind: CaptureKind) => {
    if (!windowId || captureState) return;
    const screenEl = screenSurfaceRef.current;
    const iframeEl = iframeRef.current;
    if (!screenEl) return;

    const controller = new AbortController();
    captureAbortRef.current = controller;
    const isLong = kind === 'fullPage' || kind === 'fullPage-framed';
    setCaptureState({
      isLong,
      percent: isLong ? 5 : 40,
      currentSlice: 1,
      totalSlices: 1,
    });

    // Render capture cleanly at crisp >=2x device logical pixel density regardless of host monitor PPI
    const targetScale = Math.max(1, 2 / (window.devicePixelRatio || 1));
    setCaptureScaleOverride(targetScale);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 70)));
      });

      let res;
      if (isLong) {
        if (!iframeEl) return;
        res = await captureFullPageSnapshot({
          windowId,
          screenEl,
          stageEl: stageRef.current,
          iframeEl,
          device: activeDevice,
          orientation,
          framed: kind === 'fullPage-framed',
          signal: controller.signal,
          onProgress: (info: CaptureProgressInfo) => {
            setCaptureState({
              isLong: true,
              percent: info.percent,
              currentSlice: info.currentSlice,
              totalSlices: info.totalSlices,
            });
          },
        });
      } else if (kind === 'framed-transparent') {
        res = await captureTransparentFramedSnapshot({
          windowId,
          screenEl,
          stageEl: stageRef.current,
          device: activeDevice,
          orientation,
        });
      } else {
        res = await captureScreenSnapshot({
          windowId,
          screenEl,
          stageEl: stageRef.current,
          device: activeDevice,
          orientation,
        });
      }

      if (res?.aborted) {
        showToast(t('captureCancelled'));
      } else if (res?.canvas) {
        setPreviewCapture({
          canvas: res.canvas,
          filenameBase: res.filenameBase,
          dpi: res.dpi ?? 305,
        });
        if (res.fallbackToScreen) {
          showToast(t('captureFallbackNote'));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`${t('captureFailed')} ${msg}`);
    } finally {
      captureAbortRef.current = null;
      setCaptureScaleOverride(null);
      setCaptureState(null);
    }
  };

  const sliceProgressLabel = captureState
    ? t('capturingSliceProgress')
        .replace('{current}', String(captureState.currentSlice))
        .replace('{total}', String(captureState.totalSlices))
    : '';

  return (
    <div className={isDark ? 'dark' : ''} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex h-screen flex-col bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#0D0D0F] dark:text-[#F5F5F7]">
        <Toolbar
          devices={allDevices}
          selectedDeviceId={activeDevice.id}
          onSelectDevice={(id) => {
            const matched = allDevices.find((d) => d.id === id);
            setSelectedDeviceId(id);
            setOrientation(defaultOrientationForDevice(matched));
            setLeftTipsUserCollapsed(null);
            setRightSpecsUserCollapsed(null);
            void handleUpdateSettings({ defaultDeviceId: id });
          }}
          onOpenCustomDevice={() => setCustomDeviceOpen(true)}
          orientation={orientation}
          onToggleOrientation={() =>
            setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))
          }
          showFrame={showFrame}
          onToggleFrame={() => {
            const next = !showFrame;
            setShowFrame(next);
            void handleUpdateSettings({ defaultShowFrame: next });
          }}
          showBrowserBars={showBrowserBars}
          onToggleBrowserBars={() => {
            const next = !showBrowserBars;
            setShowBrowserBars(next);
            void handleUpdateSettings({ defaultShowBrowserBars: next });
          }}
          showSafeArea={showSafeArea}
          onToggleSafeArea={() => {
            const next = !showSafeArea;
            setShowSafeArea(next);
            void handleUpdateSettings({ showSafeArea: next });
          }}
          scaleMode={scaleMode}
          onChangeScaleMode={handleChangeScaleMode}
          calibration={currentCalibration}
          cssPxPerMm={cssPxPerMm}
          onOpenCalibration={() => setCalibrationOpen(true)}
          onCapture={(kind) => void handleCapture(kind)}
          capturing={captureState !== null}
          captureProgress={captureState ? captureState.percent : null}
          onExitInPlace={onExitInPlace}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSponsor={() => setSponsorOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          t={t}
        />

        {captureState && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={captureState.percent}
            aria-label={captureState.isLong ? t('capturingLongTitle') : t('capturingSingleTitle')}
            className="relative z-[105] flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#007AFF] bg-white px-5 py-2.5 text-xs text-[#1D1D1F] shadow-md dark:border-[#0A84FF] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
          >
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {captureState.isLong ? t('capturingLongTitle') : t('capturingSingleTitle')}
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#98989D]">
                  · {t('captureSubHint')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-2.5 w-44 overflow-hidden rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E]">
                <div
                  style={{ width: `${captureState.percent}%` }}
                  className="h-full rounded-full bg-[#007AFF] transition-all duration-200 dark:bg-[#0A84FF]"
                />
              </div>
              <span className="rounded-full bg-[#007AFF]/12 px-2.5 py-0.5 font-mono font-semibold tabular-nums text-[#0066D6] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]">
                {captureState.percent}%{captureState.isLong ? ` · ${sliceProgressLabel}` : ''}
              </span>
              {captureState.isLong && (
                <button
                  type="button"
                  onClick={() => captureAbortRef.current?.abort()}
                  className="cursor-pointer rounded-xl bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {t('cancelCapture')} (Esc)
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          {!captureState && (
            <>
              <SideTipsStack
                calibration={currentCalibration}
                scaleMode={scaleMode}
                dismissedConflictNotice={settings.dismissedConflictNotice}
                dismissedPreviewHint={Boolean(settings.dismissedPreviewHint)}
                collapsed={leftTipsCollapsed}
                onToggleCollapse={() => setLeftTipsUserCollapsed(!leftTipsCollapsed)}
                onOpenCalibration={() => setCalibrationOpen(true)}
                onSwitchToCrisp={() => handleChangeScaleMode('pixel-crisp')}
                onDismissConflictNotice={() =>
                  void handleUpdateSettings({ dismissedConflictNotice: true })
                }
                onDismissPreviewHint={() =>
                  void handleUpdateSettings({ dismissedPreviewHint: true })
                }
                t={t}
              />
              <RightStagePanel
                device={activeDevice}
                orientation={orientation}
                effectiveScale={effectiveScale}
                metrics={metrics}
                collapsed={rightSpecsCollapsed}
                onToggleCollapse={() => setRightSpecsUserCollapsed(!rightSpecsCollapsed)}
                t={t}
              />
            </>
          )}

          <DeviceStage
            device={activeDevice}
            url={targetUrl}
            reloadKey={reloadKey}
            rulesReady={rulesReady}
            orientation={orientation}
            showFrame={showFrame}
            showBrowserBars={showBrowserBars}
            showSafeArea={showSafeArea}
            effectiveScale={effectiveScale}
            metrics={metrics}
            stageRef={stageRef}
            screenSurfaceRef={screenSurfaceRef}
            iframeRef={iframeRef}
            extraTopInset={sideClearance < 240}
            quickNavDock={
              !captureState ? (
                <QuickNavDock
                  isRtl={isRtl}
                  onBack={() => handleNavHistory(-1)}
                  onForward={() => handleNavHistory(1)}
                  onReload={() => void handleReloadViewport()}
                  onScrollTop={() => handleScrollEdge('top')}
                  onScrollBottom={() => handleScrollEdge('bottom')}
                  t={t}
                />
              ) : undefined
            }
          />

          <FeatureGuideOverlay
            open={guideOpen}
            isCalibrated={Boolean(currentCalibration?.isCalibrated)}
            onClose={handleCloseGuide}
            onOpenCalibration={() => setCalibrationOpen(true)}
            t={t}
          />
        </div>

        {captureState && (
          <div
            aria-hidden="true"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="fixed inset-0 z-[95] cursor-wait bg-transparent"
          />
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-[110] -translate-x-1/2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-xs font-medium text-[#1D1D1F] shadow-xl dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
          >
            {toast}
          </div>
        )}

        <ScreenshotPreviewModal
          open={previewCapture !== null}
          sourceCanvas={previewCapture?.canvas ?? null}
          filenameBase={previewCapture?.filenameBase ?? 'truescale-capture'}
          dpi={previewCapture?.dpi ?? 305}
          onClose={() => setPreviewCapture(null)}
          onNotify={showToast}
          t={t}
        />

        <CalibrationModal
          open={calibrationOpen}
          onClose={() => setCalibrationOpen(false)}
          devices={allDevices}
          monitorKey={monitorKey}
          currentProfile={currentCalibration}
          allProfiles={calibrations}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
          locale={locale}
          t={t}
        />

        <CustomDeviceModal
          open={customDeviceOpen}
          onClose={() => setCustomDeviceOpen(false)}
          onSave={handleSaveCustomDevice}
          t={t}
        />

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetCalibration={handleResetCalibration}
          onResetPlugin={handleResetPlugin}
          customDevices={customDevices}
          onDeleteCustomDevice={handleDeleteCustomDevice}
          t={t}
        />

        <SponsorModal open={sponsorOpen} onClose={() => setSponsorOpen(false)} t={t} />
      </div>
    </div>
  );
}
