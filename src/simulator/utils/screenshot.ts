import { getDevicePhysicalSizeMm } from '../../shared/scale';
import type {
  DeviceProfile,
  Orientation,
  RuntimeRequest,
  RuntimeResponse,
} from '../../shared/types';

export type CaptureKind = 'screen' | 'framed-transparent' | 'fullPage' | 'fullPage-framed';

export interface CaptureProgressInfo {
  percent: number;
  currentSlice: number;
  totalSlices: number;
}

export interface CaptureResult {
  kind: CaptureKind;
  fallbackToScreen?: boolean;
  aborted?: boolean;
  filenameBase: string;
  canvas?: HTMLCanvasElement;
  dpi?: number;
}

interface ScrollInfo {
  ok: boolean;
  scrollHeight: number;
  clientHeight: number;
  scrollY: number;
  maxScrollY: number;
  isWindowScrollable: boolean;
}

interface ScrollToResult {
  ok: boolean;
  actualY: number;
  scrollHeight: number;
  clientHeight: number;
}

const CAPTURE_MIN_INTERVAL_MS = 560;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitAnimationFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode captured PNG'));
    img.src = dataUrl;
  });
}

async function captureVisibleTabPng(windowId: number): Promise<string> {
  const req: RuntimeRequest = { type: 'CAPTURE_VISIBLE_TAB', windowId };
  const res = (await chrome.runtime.sendMessage(req)) as RuntimeResponse<string>;
  if (!res?.ok || !res.data) {
    throw new Error(res && !res.ok ? res.error : 'captureVisibleTab unavailable');
  }
  return res.data;
}

function buildFilenameBase(deviceName: string, kind: CaptureKind): string {
  const slug = deviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `truescale-${slug || 'device'}-${kind}-${ts}`;
}

function getStageBounds(stageEl?: HTMLElement | null) {
  if (!stageEl) {
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  }
  const r = stageEl.getBoundingClientRect();
  return {
    left: Math.max(0, r.left),
    top: Math.max(0, r.top),
    right: Math.min(window.innerWidth, r.right),
    bottom: Math.min(window.innerHeight, r.bottom),
  };
}

function getClippedRectInStage(el: HTMLElement, stageEl?: HTMLElement | null) {
  const rect = el.getBoundingClientRect();
  const bounds = getStageBounds(stageEl);
  const left = Math.max(bounds.left, rect.left);
  const top = Math.max(bounds.top, rect.top);
  const right = Math.min(bounds.right, rect.right);
  const bottom = Math.min(bounds.bottom, rect.bottom);
  return {
    raw: rect,
    bounds,
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    topHiddenPx: Math.max(0, top - rect.top),
  };
}

function computePhysicalDpi(
  device: DeviceProfile,
  orientation: Orientation,
  screenPixelWidth: number,
): number {
  const { widthMm, heightMm } = getDevicePhysicalSizeMm(device);
  const physWidthMm = orientation === 'portrait' ? widthMm : heightMm;
  const physInches = Math.max(0.5, physWidthMm / 25.4);
  return Math.max(72, Math.round(screenPixelWidth / physInches));
}

function postToIframe<T>(
  iframeEl: HTMLIFrameElement,
  message: Record<string, unknown>,
  timeoutMs = 1500,
): Promise<T | null> {
  const targetWin = iframeEl.contentWindow;
  if (!targetWin) return Promise.resolve(null);

  const reqId = `ts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve(null);
    }, timeoutMs);

    const onMsg = (event: MessageEvent) => {
      if (event.source !== targetWin) return;
      const data = event.data;
      if (data?.type === 'TS_MSG_REPLY' && data?.reqId === reqId) {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve((data.payload as T) ?? null);
      }
    };

    window.addEventListener('message', onMsg);
    targetWin.postMessage({ ...message, reqId }, '*');
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function withHiddenDomCutouts<T>(screenEl: HTMLElement, fn: () => Promise<T>): Promise<T> {
  const scope = screenEl.parentElement ?? screenEl;
  const cutouts = Array.from(scope.querySelectorAll<HTMLElement>('[data-ts-cutout="true"]'));
  const prev = cutouts.map((el) => el.style.visibility);
  for (const el of cutouts) {
    el.style.setProperty('visibility', 'hidden', 'important');
  }
  if (cutouts.length > 0) {
    await waitAnimationFrames(1);
  }
  try {
    return await fn();
  } finally {
    cutouts.forEach((el, i) => {
      if (prev[i]) {
        el.style.visibility = prev[i];
      } else {
        el.style.removeProperty('visibility');
      }
    });
  }
}

/**
 * Wraps any inner screen canvas (single-screen or elongated tall screen) inside a
 * 100% transparent-corner rounded titanium bezel with accurate hardware camera cutout.
 */
function wrapScreenInTransparentBezel(params: {
  screenCanvas: HTMLCanvasElement;
  device: DeviceProfile;
  orientation: Orientation;
  pixelRatioToLogicalCss: number;
}): HTMLCanvasElement {
  const { screenCanvas, device, orientation, pixelRatioToLogicalCss } = params;
  const screenW = screenCanvas.width;
  const screenH = screenCanvas.height;
  const r = pixelRatioToLogicalCss;

  const bezelPx = Math.round(device.bezel.bezelWidth * r);
  const outerRadius = Math.round(device.bezel.outerRadius * r);
  const innerRadius = Math.round(device.bezel.innerRadius * r);

  const canvas = document.createElement('canvas');
  canvas.width = screenW + bezelPx * 2;
  canvas.height = screenH + bezelPx * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawRoundedRectPath(ctx, 0, 0, canvas.width, canvas.height, outerRadius);
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#2B2B2E');
  grad.addColorStop(0.5, '#1C1C1E');
  grad.addColorStop(1, '#262629');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 1.5 * r);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.stroke();

  if (device.bezel.cutout.type === 'tablet-bezel') {
    const cutout = device.bezel.cutout;
    const cw = Math.max(4, Math.round(cutout.width * r));
    const offsetPx = Math.round(cutout.topOffset * r);
    const radius = cw / 2;
    const isLandscapeEdgeCam = cutout.tabletCameraEdge === 'landscape-top';

    let cx = canvas.width / 2;
    let cy = offsetPx + radius;

    if (isLandscapeEdgeCam && orientation === 'portrait') {
      cx = canvas.width - offsetPx - radius;
      cy = canvas.height / 2;
    } else if (!isLandscapeEdgeCam && orientation === 'landscape') {
      cx = offsetPx + radius;
      cy = canvas.height / 2;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0D0D0F';
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1 * r);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();
  }

  ctx.save();
  drawRoundedRectPath(ctx, bezelPx, bezelPx, screenW, screenH, innerRadius);
  ctx.clip();
  ctx.drawImage(screenCanvas, bezelPx, bezelPx);

  if (orientation === 'portrait') {
    const centerX = bezelPx + screenW / 2;
    const cutout = device.bezel.cutout;
    if (cutout.type === 'dynamic-island') {
      const pw = Math.round(cutout.width * r);
      const ph = Math.round(cutout.height * r);
      const py = bezelPx + Math.round(cutout.topOffset * r);
      drawRoundedRectPath(ctx, centerX - pw / 2, py, pw, ph, ph / 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (cutout.type === 'notch') {
      const nw = Math.round(cutout.width * r);
      const nh = Math.round(cutout.height * r);
      drawRoundedRectPath(ctx, centerX - nw / 2, bezelPx - 4, nw, nh + 4, Math.round(16 * r));
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (cutout.type === 'punch-hole') {
      const pr = Math.round((cutout.width / 2) * r);
      const py = bezelPx + Math.round(cutout.topOffset * r) + pr;
      ctx.beginPath();
      ctx.arc(centerX, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
  }
  ctx.restore();

  return canvas;
}

/**
 * Captures the complete `screenEl` at the active high-res scale, automatically scrolling
 * `stageEl` vertically if `screenEl` exceeds viewport height (e.g. 2× scale on 1080p monitors).
 */
async function captureFullScreenElementCanvas(params: {
  windowId: number;
  screenEl: HTMLElement;
  stageEl: HTMLElement | null;
}): Promise<HTMLCanvasElement> {
  const { windowId, screenEl, stageEl } = params;
  const origStageTop = stageEl?.scrollTop ?? 0;

  try {
    if (stageEl) {
      const bounds = stageEl.getBoundingClientRect();
      const sRect = screenEl.getBoundingClientRect();
      const delta = sRect.top - (bounds.top + 8);
      if (Math.abs(delta) > 2) {
        stageEl.scrollTop = Math.max(0, stageEl.scrollTop + delta);
        await waitAnimationFrames(2);
      }
    }

    const img0 = await loadImage(await captureVisibleTabPng(windowId));
    let lastCapAt = Date.now();
    const scaleX = img0.naturalWidth / window.innerWidth;
    const scaleY = img0.naturalHeight / window.innerHeight;

    const clip0 = getClippedRectInStage(screenEl, stageEl);
    const fullW = Math.max(1, Math.round(clip0.raw.width * scaleX));
    const fullH = Math.max(1, Math.round(clip0.raw.height * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = fullW;
    canvas.height = fullH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, fullW, fullH);

    const drawSlice = (img: HTMLImageElement, clip: ReturnType<typeof getClippedRectInStage>) => {
      // Skip 4px when top-clipped against the stage border to avoid subpixel <header> seam lines
      const topInset = clip.top > clip.raw.top + 1 ? 4 : 0;
      const bottomTrim = clip.raw.bottom > clip.bounds.bottom - 1 ? 4 : 0;
      const srcTop = clip.top + topInset;
      const srcH = Math.max(0, clip.height - topInset - bottomTrim);
      const destY = Math.round((srcTop - clip.raw.top) * scaleY);
      const sliceH = Math.min(Math.round(srcH * scaleY), fullH - destY);
      if (sliceH <= 0) return destY;
      ctx.drawImage(
        img,
        clip.left * scaleX,
        srcTop * scaleY,
        clip.width * scaleX,
        sliceH,
        0,
        Math.max(0, destY),
        fullW,
        sliceH,
      );
      return destY + sliceH;
    };

    let coveredBottomPx = drawSlice(img0, clip0);

    // If clipped at bottom edge (common when 2× scale makes phone 1700px+ tall on 1080p)
    let safety = 0;
    while (coveredBottomPx < fullH - 2 && stageEl && safety < 6) {
      safety += 1;
      const availStageH = Math.max(120, Math.floor(stageEl.clientHeight * 0.78));
      const maxStageScroll = Math.max(0, stageEl.scrollHeight - stageEl.clientHeight);
      if (stageEl.scrollTop >= maxStageScroll - 1) break;

      const prevTop = stageEl.scrollTop;
      stageEl.scrollTop = Math.min(maxStageScroll, prevTop + availStageH);
      await waitAnimationFrames(2);
      if (stageEl.scrollTop <= prevTop + 1) break;

      const waitMs = CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCapAt);
      if (waitMs > 0) await sleep(waitMs);

      const nextImg = await loadImage(await captureVisibleTabPng(windowId));
      lastCapAt = Date.now();
      const nextClip = getClippedRectInStage(screenEl, stageEl);
      coveredBottomPx = Math.max(coveredBottomPx, drawSlice(nextImg, nextClip));
    }

    return canvas;
  } finally {
    if (stageEl) {
      stageEl.scrollTop = origStageTop;
    }
  }
}

export async function captureScreenSnapshot(params: {
  windowId: number;
  screenEl: HTMLElement;
  stageEl: HTMLElement | null;
  device: DeviceProfile;
  orientation: Orientation;
}): Promise<CaptureResult> {
  const { windowId, screenEl, stageEl, device, orientation } = params;
  const screenCanvas = await captureFullScreenElementCanvas({ windowId, screenEl, stageEl });
  const dpi = computePhysicalDpi(device, orientation, screenCanvas.width);
  return {
    kind: 'screen',
    filenameBase: buildFilenameBase(device.name, 'screen'),
    canvas: screenCanvas,
    dpi,
  };
}

export async function captureTransparentFramedSnapshot(params: {
  windowId: number;
  screenEl: HTMLElement;
  stageEl: HTMLElement | null;
  device: DeviceProfile;
  orientation: Orientation;
}): Promise<CaptureResult> {
  const { windowId, screenEl, stageEl, device, orientation } = params;
  const screenCanvas = await withHiddenDomCutouts(screenEl, () =>
    captureFullScreenElementCanvas({ windowId, screenEl, stageEl }),
  );
  const viewportW = orientation === 'portrait' ? device.cssWidth : device.cssHeight;
  const pixelRatioToLogicalCss = screenCanvas.width / Math.max(1, viewportW);

  const framedCanvas = wrapScreenInTransparentBezel({
    screenCanvas,
    device,
    orientation,
    pixelRatioToLogicalCss,
  });

  const dpi = computePhysicalDpi(device, orientation, screenCanvas.width);
  return {
    kind: 'framed-transparent',
    filenameBase: buildFilenameBase(device.name, 'framed-transparent'),
    canvas: framedCanvas,
    dpi,
  };
}

export async function captureFullPageSnapshot(params: {
  windowId: number;
  screenEl: HTMLElement;
  stageEl: HTMLElement | null;
  iframeEl: HTMLIFrameElement;
  device: DeviceProfile;
  orientation: Orientation;
  framed: boolean;
  onProgress?: (info: CaptureProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<CaptureResult> {
  const {
    windowId,
    screenEl,
    stageEl,
    iframeEl,
    device,
    orientation,
    framed,
    onProgress,
    signal,
  } = params;
  const viewportW = orientation === 'portrait' ? device.cssWidth : device.cssHeight;
  const kind: CaptureKind = framed ? 'fullPage-framed' : 'fullPage';

  if (signal?.aborted) {
    return { kind, aborted: true, filenameBase: '' };
  }

  const scrollInfo = await postToIframe<ScrollInfo>(iframeEl, { type: 'TS_MSG_GET_SCROLL' });
  if (!scrollInfo?.ok || !scrollInfo.isWindowScrollable) {
    if (signal?.aborted) {
      return { kind, aborted: true, filenameBase: '' };
    }
    if (framed) {
      const res = await captureTransparentFramedSnapshot({
        windowId,
        screenEl,
        stageEl,
        device,
        orientation,
      });
      return { ...res, fallbackToScreen: true };
    }
    const res = await captureScreenSnapshot({
      windowId,
      screenEl: iframeEl,
      stageEl,
      device,
      orientation,
    });
    return { ...res, fallbackToScreen: true };
  }

  const originalScrollY = scrollInfo.scrollY;
  const originalStageScrollTop = stageEl?.scrollTop ?? 0;

  if (stageEl) {
    const bounds = stageEl.getBoundingClientRect();
    const sRect = screenEl.getBoundingClientRect();
    const delta = sRect.top - (bounds.top + 8);
    if (Math.abs(delta) > 2) {
      stageEl.scrollTop = Math.max(0, stageEl.scrollTop + delta);
      await waitAnimationFrames(2);
    }
  }

  const runCapture = async (): Promise<CaptureResult> => {
    try {
      const clip = getClippedRectInStage(iframeEl, stageEl);
      const screenClip = getClippedRectInStage(screenEl, stageEl);
      const liveScale = clip.raw.width / Math.max(1, viewportW);
      const visibleIframeCssH = clip.height / liveScale;
      const topHiddenIframeCss = clip.topHiddenPx / liveScale;
      const maxPages = 16;

      const firstScroll = await postToIframe<ScrollToResult>(iframeEl, {
        type: 'TS_MSG_SCROLL_TO',
        y: 0,
        hideFixed: false,
      });
      if (signal?.aborted) {
        return { kind, aborted: true, filenameBase: '' };
      }
      if (!firstScroll?.ok) {
        const res = await captureScreenSnapshot({
          windowId,
          screenEl: iframeEl,
          stageEl,
          device,
          orientation,
        });
        return { ...res, fallbackToScreen: true };
      }

      const firstImg = await loadImage(await captureVisibleTabPng(windowId));
      if (signal?.aborted) {
        return { kind, aborted: true, filenameBase: '' };
      }
      let lastCaptureAt = Date.now();

      const scaleX = firstImg.naturalWidth / window.innerWidth;
      const scaleY = firstImg.naturalHeight / window.innerHeight;
      const pxPerIframeCss = (clip.raw.height * scaleY) / Math.max(1, firstScroll.clientHeight);

      const topChromePx = framed
        ? Math.max(0, Math.round((clip.raw.top - screenClip.raw.top) * scaleY))
        : 0;
      const bottomChromePx = framed
        ? Math.max(0, Math.round((screenClip.raw.bottom - clip.raw.bottom) * scaleY))
        : 0;

      const maxCanvasPxH = 24_000;
      const maxHeightCssByCanvas = Math.max(
        scrollInfo.clientHeight,
        Math.floor((maxCanvasPxH - topChromePx - bottomChromePx) / Math.max(0.1, pxPerIframeCss)),
      );
      const totalHeightCss = Math.min(
        scrollInfo.scrollHeight,
        scrollInfo.clientHeight * maxPages,
        maxHeightCssByCanvas,
      );
      const stepCss = Math.max(80, Math.floor(visibleIframeCssH * 0.8));
      const estimatedSlices = Math.max(
        1,
        Math.ceil(Math.max(0, totalHeightCss - visibleIframeCssH) / stepCss) + 1,
      );

      const fullIframePxH = Math.max(1, Math.round(totalHeightCss * pxPerIframeCss));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(clip.raw.width * scaleX));
      canvas.height = topChromePx + fullIframePxH + bottomChromePx;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Copy top status/URL bar strip (guaranteed visible since stageEl aligned top)
      if (framed && topChromePx > 0) {
        ctx.drawImage(
          firstImg,
          screenClip.raw.left * scaleX,
          screenClip.raw.top * scaleY,
          canvas.width,
          topChromePx,
          0,
          0,
          canvas.width,
          topChromePx,
        );
      }

      const drawSegment = (
        img: HTMLImageElement,
        curClip: ReturnType<typeof getClippedRectInStage>,
        destOffsetCss: number,
      ) => {
        const topInset = curClip.top > curClip.raw.top + 1 ? 3 : 0;
        const srcTop = curClip.top + topInset;
        const srcH = Math.max(0, curClip.height - topInset);
        const destY = topChromePx + Math.round((destOffsetCss + topInset / liveScale) * pxPerIframeCss);
        const drawH = Math.min(
          Math.round(srcH * scaleY),
          topChromePx + fullIframePxH - destY,
        );
        if (drawH <= 0) return;
        ctx.drawImage(
          img,
          curClip.left * scaleX,
          srcTop * scaleY,
          curClip.raw.width * scaleX,
          drawH,
          0,
          destY,
          canvas.width,
          drawH,
        );
      };

      let sliceIndex = 1;
      drawSegment(firstImg, clip, firstScroll.actualY + topHiddenIframeCss);
      onProgress?.({
        percent: Math.min(95, Math.round((visibleIframeCssH / totalHeightCss) * 100)),
        currentSlice: sliceIndex,
        totalSlices: estimatedSlices,
      });

      let targetY = stepCss;
      let prevActualY = firstScroll.actualY;
      let coveredCss = firstScroll.actualY + topHiddenIframeCss + visibleIframeCssH;

      while (targetY < totalHeightCss - 2 && coveredCss < totalHeightCss - 2) {
        if (signal?.aborted) {
          return { kind, aborted: true, filenameBase: '' };
        }
        const scrolled = await postToIframe<ScrollToResult>(iframeEl, {
          type: 'TS_MSG_SCROLL_TO',
          y: targetY,
          hideFixed: true,
        });
        if (signal?.aborted) {
          return { kind, aborted: true, filenameBase: '' };
        }
        if (!scrolled?.ok || scrolled.actualY <= prevActualY + 2) {
          break;
        }

        const waitMs = CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCaptureAt);
        if (waitMs > 0) await sleep(waitMs);
        if (signal?.aborted) {
          return { kind, aborted: true, filenameBase: '' };
        }

        const frameImg = await loadImage(await captureVisibleTabPng(windowId));
        if (signal?.aborted) {
          return { kind, aborted: true, filenameBase: '' };
        }
        lastCaptureAt = Date.now();
        const curClip = getClippedRectInStage(iframeEl, stageEl);
        const curHiddenCss = curClip.topHiddenPx / liveScale;
        drawSegment(frameImg, curClip, scrolled.actualY + curHiddenCss);

        sliceIndex += 1;
        prevActualY = scrolled.actualY;
        coveredCss = scrolled.actualY + curHiddenCss + curClip.height / liveScale;
        onProgress?.({
          percent: Math.min(94, Math.round((coveredCss / totalHeightCss) * 100)),
          currentSlice: Math.min(sliceIndex, estimatedSlices),
          totalSlices: estimatedSlices,
        });

        targetY = prevActualY + stepCss;
      }

      // Sweep outer stageEl incrementally downward whenever scaled phone height exceeds stage viewport height,
      // ensuring zero vertical gaps between the final iframe slice and bottom browser chrome.
      let bottomImgForChrome: HTMLImageElement = firstImg;
      let bottomScreenClip = getClippedRectInStage(screenEl, stageEl);
      let bottomIframeClip = getClippedRectInStage(iframeEl, stageEl);

      let bottomSweepSafety = 0;
      while (
        stageEl &&
        bottomScreenClip.raw.bottom > bottomScreenClip.bounds.bottom + 1 &&
        bottomSweepSafety < 8
      ) {
        bottomSweepSafety += 1;
        const maxStageScroll = Math.max(0, stageEl.scrollHeight - stageEl.clientHeight);
        if (stageEl.scrollTop >= maxStageScroll - 1) break;

        const prevStageTop = stageEl.scrollTop;
        const stageStep = Math.max(120, Math.floor(stageEl.clientHeight * 0.72));
        stageEl.scrollTop = Math.min(maxStageScroll, prevStageTop + stageStep);
        await waitAnimationFrames(2);
        if (stageEl.scrollTop <= prevStageTop + 1) break;

        const waitMs = CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCaptureAt);
        if (waitMs > 0) await sleep(waitMs);
        if (signal?.aborted) return { kind, aborted: true, filenameBase: '' };

        bottomImgForChrome = await loadImage(await captureVisibleTabPng(windowId));
        lastCaptureAt = Date.now();
        bottomScreenClip = getClippedRectInStage(screenEl, stageEl);
        bottomIframeClip = getClippedRectInStage(iframeEl, stageEl);

        const bottomHiddenCss = bottomIframeClip.topHiddenPx / liveScale;
        drawSegment(bottomImgForChrome, bottomIframeClip, prevActualY + bottomHiddenCss);
      }

      if (framed && bottomChromePx > 0) {
        ctx.drawImage(
          bottomImgForChrome,
          bottomScreenClip.raw.left * scaleX,
          bottomIframeClip.raw.bottom * scaleY,
          canvas.width,
          bottomChromePx,
          0,
          topChromePx + fullIframePxH,
          canvas.width,
          bottomChromePx,
        );
      }

      if (signal?.aborted) {
        return { kind, aborted: true, filenameBase: '' };
      }

      onProgress?.({ percent: 100, currentSlice: estimatedSlices, totalSlices: estimatedSlices });
      const filenameBase = buildFilenameBase(device.name, kind);
      const dpi = computePhysicalDpi(device, orientation, canvas.width);

      if (framed) {
        const pixelRatioToLogicalCss = canvas.width / Math.max(1, viewportW);
        const elongatedBezelCanvas = wrapScreenInTransparentBezel({
          screenCanvas: canvas,
          device,
          orientation,
          pixelRatioToLogicalCss,
        });
        return { kind, filenameBase, canvas: elongatedBezelCanvas, dpi };
      }
      return { kind, filenameBase, canvas, dpi };
    } finally {
      await postToIframe(iframeEl, { type: 'TS_MSG_RESTORE_SCROLL', y: originalScrollY });
      if (stageEl) {
        stageEl.scrollTop = originalStageScrollTop;
      }
    }
  };

  return framed ? withHiddenDomCutouts(screenEl, runCapture) : runCapture();
}
