import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { DeviceProfile, Orientation, ScaleMetrics } from '../../shared/types';
import {
  AndroidBatteryIcon,
  AndroidSignalIcon,
  HttpsLockIcon,
  IosBatteryIcon,
  IosSignalIcon,
  SolidWifiIcon,
} from './StatusBarIcons';

interface DeviceStageProps {
  device: DeviceProfile;
  url: string;
  reloadKey: number;
  rulesReady: boolean;
  orientation: Orientation;
  showFrame: boolean;
  showBrowserBars: boolean;
  showSafeArea: boolean;
  effectiveScale: number;
  metrics: ScaleMetrics;
  stageRef: RefObject<HTMLDivElement | null>;
  screenSurfaceRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  quickNavDock?: ReactNode;
  extraTopInset?: boolean;
}

export function DeviceStage({
  device,
  url,
  reloadKey,
  rulesReady,
  orientation,
  showFrame,
  showBrowserBars,
  showSafeArea,
  effectiveScale,
  metrics,
  stageRef,
  screenSurfaceRef,
  iframeRef,
  quickNavDock,
  extraTopInset = false,
}: DeviceStageProps) {
  const isPortrait = orientation === 'portrait';
  const bezelPad = showFrame ? device.bezel.bezelWidth : 0;
  const outerRadius = showFrame ? device.bezel.outerRadius : 0;
  const innerRadius = showFrame ? device.bezel.innerRadius : 0;
  const cutout = device.bezel.cutout;

  const logicalOuterW = metrics.viewportWidthPx + bezelPad * 2;
  const logicalOuterH = metrics.viewportHeightPx + bezelPad * 2;

  const scaledOuterW = logicalOuterW * effectiveScale;
  const scaledOuterH = logicalOuterH * effectiveScale;

  const topStatusH =
    showBrowserBars && isPortrait ? device.browserChrome.topStatusBar : showBrowserBars ? 24 : 0;
  const topUrlH = showBrowserBars ? device.browserChrome.topUrlBar : 0;
  const bottomBarH = showBrowserBars ? (isPortrait ? device.browserChrome.bottomBar : 18) : 0;

  const iframeHeight = Math.max(200, metrics.viewportHeightPx - topStatusH - topUrlH - bottomBarH);

  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const isHttps = url.startsWith('https://');
  const isIos = device.os === 'ios';

  const statusBandTop = isPortrait ? cutout.topOffset : 0;
  const statusBandHeight = isPortrait ? Math.max(24, topStatusH - statusBandTop) : topStatusH;

  const outerBezelStyle: CSSProperties = showFrame
    ? {
        width: `${logicalOuterW}px`,
        height: `${logicalOuterH}px`,
        transform: `scale(${effectiveScale})`,
        transformOrigin: 'top left',
        padding: `${bezelPad}px`,
        borderRadius: `${outerRadius}px`,
        background: 'linear-gradient(155deg, #3A3A3E 0%, #1E1E21 38%, #161618 72%, #2B2B2F 100%)',
        boxShadow:
          '0 24px 60px -14px rgba(0, 0, 0, 0.38), 0 4px 16px rgba(0, 0, 0, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.22), inset 0 0 0 2.5px rgba(0, 0, 0, 0.72)',
      }
    : {
        width: `${logicalOuterW}px`,
        height: `${logicalOuterH}px`,
        transform: `scale(${effectiveScale})`,
        transformOrigin: 'top left',
        padding: `${bezelPad}px`,
        borderRadius: `${outerRadius}px`,
        backgroundColor: '#FFFFFF',
        boxShadow:
          '0 18px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.10)',
      };

  const renderTabletBezelCameraDot = () => {
    if (!showFrame || cutout.type !== 'tablet-bezel') return null;

    const isLandscapeEdgeCam = cutout.tabletCameraEdge === 'landscape-top';
    let posStyle: CSSProperties;

    if (isLandscapeEdgeCam) {
      posStyle = isPortrait
        ? { right: `${cutout.topOffset}px`, top: '50%', transform: 'translateY(-50%)' }
        : { top: `${cutout.topOffset}px`, left: '50%', transform: 'translateX(-50%)' };
    } else {
      posStyle = isPortrait
        ? { top: `${cutout.topOffset}px`, left: '50%', transform: 'translateX(-50%)' }
        : { left: `${cutout.topOffset}px`, top: '50%', transform: 'translateY(-50%)' };
    }

    return (
      <div
        data-ts-cutout="true"
        style={{
          position: 'absolute',
          width: `${cutout.width}px`,
          height: `${cutout.height}px`,
          borderRadius: '9999px',
          backgroundColor: '#0D0D0F',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 0 0 1px rgba(255,255,255,0.12)',
          pointerEvents: 'none',
          ...posStyle,
        }}
      />
    );
  };

  const safeTopPx = showBrowserBars
    ? topStatusH + topUrlH
    : isPortrait
      ? device.browserChrome.topStatusBar
      : 24;
  const safeBottomPx = showBrowserBars ? bottomBarH : isPortrait ? 34 : 20;

  return (
    <div
      ref={stageRef}
      dir="ltr"
      className={`ts-stage-bg relative flex flex-1 flex-col items-center overflow-auto px-[64px] ${
        extraTopInset ? 'pt-[60px] pb-[16px]' : 'py-[16px]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-center">
        <div
          className="relative shrink-0"
          style={{
            width: `${scaledOuterW}px`,
            height: `${scaledOuterH}px`,
          }}
        >
          {quickNavDock && (
            <div className="pointer-events-auto absolute left-full top-0 z-30 ml-[12px]">
              {quickNavDock}
            </div>
          )}
          <div style={outerBezelStyle} className="relative flex flex-col">
            {showFrame && isPortrait && device.category === 'phone' && (
              <>
                <div
                  style={{ backgroundColor: '#3A3A3D' }}
                  className="pointer-events-none absolute -left-[3px] top-[135px] h-[34px] w-[3px] rounded-l"
                />
                <div
                  style={{ backgroundColor: '#3A3A3D' }}
                  className="pointer-events-none absolute -left-[3px] top-[190px] h-[54px] w-[3px] rounded-l"
                />
                <div
                  style={{ backgroundColor: '#3A3A3D' }}
                  className="pointer-events-none absolute -left-[3px] top-[256px] h-[54px] w-[3px] rounded-l"
                />
                <div
                  style={{ backgroundColor: '#3A3A3D' }}
                  className="pointer-events-none absolute -right-[3px] top-[210px] h-[82px] w-[3px] rounded-r"
                />
              </>
            )}

            {renderTabletBezelCameraDot()}

            <div
              ref={screenSurfaceRef}
              style={{
                width: `${metrics.viewportWidthPx}px`,
                height: `${metrics.viewportHeightPx}px`,
                borderRadius: `${innerRadius}px`,
              }}
              className="relative flex flex-col overflow-hidden bg-white"
            >
              {showFrame && isPortrait && cutout.type === 'dynamic-island' && (
                <div
                  data-ts-cutout="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${cutout.width}px`,
                    height: `${cutout.height}px`,
                    top: `${cutout.topOffset}px`,
                    borderRadius: '9999px',
                    backgroundColor: '#000000',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    zIndex: 30,
                    pointerEvents: 'none',
                  }}
                  className="flex items-center justify-end pr-3"
                >
                  <div className="h-3 w-3 rounded-full bg-[#0F172A] ring-1 ring-sky-400/20" />
                </div>
              )}

              {showFrame && isPortrait && cutout.type === 'notch' && (
                <div
                  data-ts-cutout="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${cutout.width}px`,
                    height: `${cutout.height}px`,
                    top: `${cutout.topOffset}px`,
                    backgroundColor: '#000000',
                    borderBottomLeftRadius: '18px',
                    borderBottomRightRadius: '18px',
                    zIndex: 30,
                    pointerEvents: 'none',
                  }}
                  className="flex items-center justify-center"
                >
                  <div className="h-1.5 w-11 rounded-full bg-[#1F1F23]" />
                </div>
              )}

              {showFrame && isPortrait && cutout.type === 'punch-hole' && (
                <div
                  data-ts-cutout="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${cutout.width}px`,
                    height: `${cutout.height}px`,
                    top: `${cutout.topOffset}px`,
                    borderRadius: '9999px',
                    backgroundColor: '#000000',
                    boxShadow: '0 0 0 1px rgba(51, 65, 85, 0.9)',
                    zIndex: 30,
                    pointerEvents: 'none',
                  }}
                />
              )}

              {showBrowserBars && (
                <div
                  style={{
                    height: `${topStatusH}px`,
                    paddingTop: `${statusBandTop}px`,
                  }}
                  className="flex shrink-0 items-center justify-between bg-slate-50 px-6 text-[13px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums select-none"
                >
                  <div style={{ height: `${statusBandHeight}px` }} className="flex items-center">
                    <span>9:41</span>
                  </div>
                  <div
                    style={{ height: `${statusBandHeight}px` }}
                    className="flex items-center gap-1.5"
                  >
                    {isIos ? (
                      <>
                        <IosSignalIcon />
                        <SolidWifiIcon />
                        <IosBatteryIcon />
                      </>
                    ) : (
                      <>
                        <AndroidSignalIcon />
                        <SolidWifiIcon />
                        <AndroidBatteryIcon />
                      </>
                    )}
                  </div>
                </div>
              )}

              {showBrowserBars && (
                <div
                  style={{ height: `${topUrlH}px` }}
                  className="flex shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 select-none"
                >
                  <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-200/80 px-3 py-1 text-xs text-slate-700">
                    {isHttps && (
                      <span className="shrink-0 text-slate-500">
                        <HttpsLockIcon />
                      </span>
                    )}
                    <span className="truncate font-medium">{hostname}</span>
                  </div>
                </div>
              )}

              {rulesReady ? (
                <iframe
                  key={`${device.id}-${reloadKey}`}
                  ref={iframeRef}
                  name="__TRUESCALE_MOBILE_VIEWPORT__"
                  data-ts-viewport="true"
                  src={url}
                  title={device.name}
                  style={{
                    width: `${metrics.viewportWidthPx}px`,
                    height: `${iframeHeight}px`,
                    border: 'none',
                  }}
                  className="block shrink-0 bg-white"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              ) : (
                <div
                  style={{
                    width: `${metrics.viewportWidthPx}px`,
                    height: `${iframeHeight}px`,
                  }}
                  className="shrink-0 bg-white"
                />
              )}

              {showBrowserBars && (
                <div
                  style={{ height: `${bottomBarH}px` }}
                  className="flex shrink-0 flex-col items-center justify-end border-t border-slate-200 bg-slate-50/95 pb-2 select-none"
                >
                  <div className="h-1.5 w-28 rounded-full bg-slate-800/80" />
                </div>
              )}

              {/* Optional Safe Area visual guide overlay (auto-hidden during screenshots) */}
              {showSafeArea && (
                <>
                  <div
                    data-ts-cutout="true"
                    style={{ height: `${safeTopPx}px` }}
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-end justify-end border-b-2 border-dashed border-violet-500 bg-violet-500/15 px-3 pb-1 text-xs font-semibold text-violet-900"
                  >
                    Safe Top: {safeTopPx}px
                  </div>
                  <div
                    data-ts-cutout="true"
                    style={{ height: `${safeBottomPx}px` }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-start justify-end border-t-2 border-dashed border-violet-500 bg-violet-500/15 px-3 pt-1 text-xs font-semibold text-violet-900"
                  >
                    Safe Bottom: {safeBottomPx}px
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
