import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Circle,
  Copy,
  Download,
  Grid2x2,
  MousePointer,
  Pencil,
  Play,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import type { TranslationKeys } from '../../shared/i18n';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { canvasToExportBlob } from '../utils/pngDpi';

type AnnotationTool = 'select' | 'rect' | 'circle' | 'arrow' | 'pen' | 'text' | 'step' | 'mosaic';

type AnnotationItem =
  | { type: 'rect' | 'circle' | 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: 'pen'; points: Array<{ x: number; y: number }>; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number }
  | { type: 'step'; x: number; y: number; num: number; color: string; radius: number }
  | { type: 'mosaic'; x1: number; y1: number; x2: number; y2: number };

interface ScreenshotPreviewModalProps {
  open: boolean;
  sourceCanvas: HTMLCanvasElement | null;
  filenameBase: string;
  dpi: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
  t: (k: TranslationKeys) => string;
}

const SWATCHES = ['#EF4444', '#007AFF', '#10B981', '#F59E0B', '#1D1D1F'];
const FONT_SIZE_OPTIONS = [16, 20, 24, 32];

function isMovableItem(item: AnnotationItem): boolean {
  return item.type !== 'mosaic';
}

function translateAnnotation(item: AnnotationItem, dx: number, dy: number): AnnotationItem {
  switch (item.type) {
    case 'rect':
    case 'circle':
    case 'arrow':
    case 'mosaic':
      return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
    case 'text':
    case 'step':
      return { ...item, x: item.x + dx, y: item.y + dy };
    case 'pen':
      return { ...item, points: item.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
}

function distancePointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function getAnnotationBounds(
  item: AnnotationItem,
  ctx: CanvasRenderingContext2D,
): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (item.type) {
    case 'rect':
    case 'circle':
    case 'arrow':
    case 'mosaic': {
      const pad = item.type === 'mosaic' ? 0 : item.width / 2;
      return {
        minX: Math.min(item.x1, item.x2) - pad,
        minY: Math.min(item.y1, item.y2) - pad,
        maxX: Math.max(item.x1, item.x2) + pad,
        maxY: Math.max(item.y1, item.y2) + pad,
      };
    }
    case 'step':
      return {
        minX: item.x - item.radius - 2,
        minY: item.y - item.radius - 2,
        maxX: item.x + item.radius + 2,
        maxY: item.y + item.radius + 2,
      };
    case 'text': {
      ctx.save();
      ctx.font = `700 ${item.size}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const lines = item.text.split('\n');
      let maxW = 16;
      for (const ln of lines) {
        maxW = Math.max(maxW, ctx.measureText(ln).width);
      }
      ctx.restore();
      const h = lines.length * item.size * 1.25;
      return {
        minX: item.x - 4,
        minY: item.y - 2,
        maxX: item.x + maxW + 4,
        maxY: item.y + h + 2,
      };
    }
    case 'pen': {
      if (item.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of item.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = item.width / 2;
      return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }
  }
}

function hitTestAnnotation(
  item: AnnotationItem,
  px: number,
  py: number,
  ctx: CanvasRenderingContext2D,
  tol: number,
  allowShapeInterior: boolean,
): boolean {
  if (!isMovableItem(item)) return false;

  if (item.type === 'step') {
    return Math.hypot(px - item.x, py - item.y) <= item.radius + tol;
  }
  if (item.type === 'text') {
    const b = getAnnotationBounds(item, ctx);
    return px >= b.minX - tol && px <= b.maxX + tol && py >= b.minY - tol && py <= b.maxY + tol;
  }
  if (item.type === 'arrow') {
    return distancePointToSegment(px, py, item.x1, item.y1, item.x2, item.y2) <= tol + item.width / 2;
  }
  if (item.type === 'pen') {
    if (item.points.length === 1) {
      return Math.hypot(px - item.points[0].x, py - item.points[0].y) <= tol + item.width / 2;
    }
    for (let i = 1; i < item.points.length; i++) {
      if (
        distancePointToSegment(
          px,
          py,
          item.points[i - 1].x,
          item.points[i - 1].y,
          item.points[i].x,
          item.points[i].y,
        ) <=
        tol + item.width / 2
      ) {
        return true;
      }
    }
    return false;
  }
  if (item.type === 'rect') {
    const minX = Math.min(item.x1, item.x2);
    const maxX = Math.max(item.x1, item.x2);
    const minY = Math.min(item.y1, item.y2);
    const maxY = Math.max(item.y1, item.y2);
    const band = tol + item.width / 2;
    if (allowShapeInterior) {
      return px >= minX - band && px <= maxX + band && py >= minY - band && py <= maxY + band;
    }
    const nearLeft = Math.abs(px - minX) <= band && py >= minY - band && py <= maxY + band;
    const nearRight = Math.abs(px - maxX) <= band && py >= minY - band && py <= maxY + band;
    const nearTop = Math.abs(py - minY) <= band && px >= minX - band && px <= maxX + band;
    const nearBottom = Math.abs(py - maxY) <= band && px >= minX - band && px <= maxX + band;
    return nearLeft || nearRight || nearTop || nearBottom;
  }
  if (item.type === 'circle') {
    const cx = (item.x1 + item.x2) / 2;
    const cy = (item.y1 + item.y2) / 2;
    const rx = Math.max(4, Math.abs(item.x2 - item.x1) / 2);
    const ry = Math.max(4, Math.abs(item.y2 - item.y1) / 2);
    const nx = (px - cx) / rx;
    const ny = (py - cy) / ry;
    const normDist = Math.hypot(nx, ny);
    const bandNorm = (tol + item.width / 2) / Math.min(rx, ry);
    if (allowShapeInterior) {
      return normDist <= 1 + bandNorm;
    }
    return Math.abs(normDist - 1) <= Math.max(0.18, bandNorm);
  }
  return false;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number,
) {
  const headLen = Math.max(12, strokeW * 3.5);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function applyMosaicBlock(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const rx = Math.max(0, Math.round(Math.min(x1, x2)));
  const ry = Math.max(0, Math.round(Math.min(y1, y2)));
  const rw = Math.min(src.width - rx, Math.round(Math.abs(x2 - x1)));
  const rh = Math.min(src.height - ry, Math.round(Math.abs(y2 - y1)));
  if (rw < 4 || rh < 4) return;

  const blockSize = Math.max(10, Math.round(src.width * 0.02));
  const tinyW = Math.max(1, Math.floor(rw / blockSize));
  const tinyH = Math.max(1, Math.floor(rh / blockSize));
  const off = document.createElement('canvas');
  off.width = tinyW;
  off.height = tinyH;
  const octx = off.getContext('2d');
  if (!octx) return;
  octx.drawImage(src, rx, ry, rw, rh, 0, 0, tinyW, tinyH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, tinyW, tinyH, rx, ry, rw, rh);
  ctx.restore();
}

function drawDashedMarqueeBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  guideScale: number,
  withCornerHandles: boolean,
) {
  if (w < 1 && h < 1) return;
  ctx.save();
  if (!withCornerHandles) {
    ctx.fillStyle = 'rgba(0, 122, 255, 0.12)';
    ctx.fillRect(x, y, w, h);
  }
  const lineW = Math.max(2, Math.round(2 * guideScale));
  ctx.lineWidth = lineW;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeRect(x, y, w, h);

  ctx.setLineDash([Math.round(6 * guideScale), Math.round(4 * guideScale)]);
  ctx.strokeStyle = '#007AFF';
  ctx.strokeRect(x, y, w, h);

  if (withCornerHandles) {
    ctx.setLineDash([]);
    const hs = Math.max(6, Math.round(6 * guideScale));
    const corners = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
      ctx.lineWidth = Math.max(1.5, Math.round(1.5 * guideScale));
      ctx.strokeStyle = '#007AFF';
      ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }
  }
  ctx.restore();
}

function renderAllAnnotations(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  items: AnnotationItem[],
  overlay?: {
    draftItem?: AnnotationItem | null;
    selectedIndex?: number | null;
    guideScale?: number;
  },
) {
  ctx.clearRect(0, 0, src.width, src.height);
  ctx.drawImage(src, 0, 0);

  const combined = overlay?.draftItem ? [...items, overlay.draftItem] : items;

  for (const item of combined) {
    if (item.type === 'mosaic') {
      applyMosaicBlock(ctx, src, item.x1, item.y1, item.x2, item.y2);
      continue;
    }

    ctx.save();
    if (item.type === 'rect') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      const x = Math.min(item.x1, item.x2);
      const y = Math.min(item.y1, item.y2);
      ctx.strokeRect(x, y, Math.abs(item.x2 - item.x1), Math.abs(item.y2 - item.y1));
    } else if (item.type === 'circle') {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      const cx = (item.x1 + item.x2) / 2;
      const cy = (item.y1 + item.y2) / 2;
      const rx = Math.abs(item.x2 - item.x1) / 2;
      const ry = Math.abs(item.y2 - item.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'arrow') {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.lineCap = 'round';
      drawArrow(ctx, item.x1, item.y1, item.x2, item.y2, item.width);
    } else if (item.type === 'pen' && item.points.length > 0) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.stroke();
    } else if (item.type === 'step') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${Math.round(item.radius * 1.15)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.num), item.x, item.y + 1);
    } else if (item.type === 'text') {
      ctx.font = `700 ${item.size}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = item.text.split('\n');
      const lineStep = item.size * 1.2;
      ctx.lineWidth = Math.max(3, Math.round(item.size * 0.14));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.fillStyle = item.color;
      lines.forEach((ln, idx) => {
        const yPos = item.y + idx * lineStep;
        ctx.strokeText(ln, item.x, yPos);
        ctx.fillText(ln, item.x, yPos);
      });
    }
    ctx.restore();
  }

  const guideScale = overlay?.guideScale ?? Math.max(1, src.width / 420);

  if (overlay?.draftItem?.type === 'mosaic') {
    const d = overlay.draftItem;
    const x = Math.min(d.x1, d.x2);
    const y = Math.min(d.y1, d.y2);
    const w = Math.abs(d.x2 - d.x1);
    const h = Math.abs(d.y2 - d.y1);
    drawDashedMarqueeBox(ctx, x, y, w, h, guideScale, false);
  }

  if (
    overlay?.selectedIndex !== null &&
    overlay?.selectedIndex !== undefined &&
    overlay.selectedIndex >= 0 &&
    overlay.selectedIndex < items.length
  ) {
    const sel = items[overlay.selectedIndex];
    if (sel && isMovableItem(sel)) {
      const b = getAnnotationBounds(sel, ctx);
      const pad = Math.round(6 * guideScale);
      drawDashedMarqueeBox(
        ctx,
        b.minX - pad,
        b.minY - pad,
        b.maxX - b.minX + pad * 2,
        b.maxY - b.minY + pad * 2,
        guideScale,
        true,
      );
    }
  }
}

export function ScreenshotPreviewModal({
  open,
  sourceCanvas,
  filenameBase,
  dpi,
  onClose,
  onNotify,
  t,
}: ScreenshotPreviewModalProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tool, setTool] = useState<AnnotationTool>('rect');
  const [color, setColor] = useState<string>('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [textSize, setTextSize] = useState<number>(20);
  const [format, setFormat] = useState<'png' | 'webp' | 'jpeg'>('png');
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [undoHistory, setUndoHistory] = useState<AnnotationItem[][]>([]);
  const [redoHistory, setRedoHistory] = useState<AnnotationItem[][]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredMoveTarget, setHoveredMoveTarget] = useState<boolean>(false);
  const [draftItem, setDraftItem] = useState<AnnotationItem | null>(null);
  const [textDraft, setTextDraft] = useState<{
    x: number;
    y: number;
    value: string;
    displayRatio: number;
  } | null>(null);
  const [copiedJustNow, setCopiedJustNow] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef<boolean>(false);
  const isHoveringRef = useRef<boolean>(false);
  const manualPauseUntilRef = useRef<number>(0);
  const dragMoveRef = useRef<{
    pointerId: number;
    index: number;
    startX: number;
    startY: number;
    originItem: AnnotationItem;
    snapshotBefore: AnnotationItem[];
    moved: boolean;
  } | null>(null);

  useModalFocusTrap(open, dialogRef, onClose);

  useEffect(() => {
    if (open) {
      setIsEditing(false);
      setTool('rect');
      setAnnotations([]);
      setUndoHistory([]);
      setRedoHistory([]);
      setSelectedIndex(null);
      setHoveredMoveTarget(false);
      setDraftItem(null);
      setTextDraft(null);
      setCopiedJustNow(false);
      setIsAutoScrolling(false);
      isHoveringRef.current = false;
      manualPauseUntilRef.current = 0;
      dragMoveRef.current = null;
    }
  }, [open, sourceCanvas]);

  const commitAnnotations = useCallback(
    (next: AnnotationItem[], nextSelected: number | null) => {
      setUndoHistory((prev) => [...prev, annotations]);
      setRedoHistory([]);
      setAnnotations(next);
      setSelectedIndex(nextSelected);
    },
    [annotations],
  );

  // Focus inline textarea synchronously on open without stealing focus from IME
  useEffect(() => {
    if (!textDraft) return;
    const timer = window.setTimeout(() => {
      textAreaRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [textDraft?.x, textDraft?.y]);

  // Delete/Backspace removes selected annotation in edit mode when not typing
  useEffect(() => {
    if (!open || !isEditing || textDraft || selectedIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      const next = annotations.filter((_, idx) => idx !== selectedIndex);
      commitAnnotations(next, null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isEditing, textDraft, selectedIndex, annotations, commitAnnotations]);

  const redraw = useCallback(() => {
    const target = canvasRef.current;
    if (!target || !sourceCanvas) return;
    if (target.width !== sourceCanvas.width || target.height !== sourceCanvas.height) {
      target.width = sourceCanvas.width;
      target.height = sourceCanvas.height;
    }
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const guideScale = Math.max(1, sourceCanvas.width / 420);
    renderAllAnnotations(ctx, sourceCanvas, annotations, {
      draftItem,
      selectedIndex: isEditing ? selectedIndex : null,
      guideScale,
    });
  }, [sourceCanvas, annotations, draftItem, isEditing, selectedIndex]);

  useEffect(() => {
    if (open) redraw();
  }, [open, redraw]);

  // Smooth Ping-Pong auto-scroll loop for long screenshots in non-editing Preview mode
  useEffect(() => {
    if (!open || isEditing || !sourceCanvas) {
      setIsAutoScrolling(false);
      return;
    }
    const el = scrollBoxRef.current;
    if (!el) return;

    let rafId = 0;
    let direction: 1 | -1 = 1;
    let pauseUntil = performance.now() + 700;
    let lastTs = performance.now();
    let floatTop = 0;
    el.scrollTop = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const isLongScrollable = maxScroll > 48;
      setIsAutoScrolling(isLongScrollable);

      if (isLongScrollable) {
        if (isHoveringRef.current || now < manualPauseUntilRef.current) {
          floatTop = el.scrollTop;
        } else if (now >= pauseUntil) {
          const speedPxPerSec = Math.min(220, Math.max(115, maxScroll * 0.08));
          floatTop += direction * speedPxPerSec * dt;
          if (direction === 1 && floatTop >= maxScroll) {
            floatTop = maxScroll;
            direction = -1;
            pauseUntil = now + 750;
          } else if (direction === -1 && floatTop <= 0) {
            floatTop = 0;
            direction = 1;
            pauseUntil = now + 750;
          }
          el.scrollTop = floatTop;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    const startTimer = window.setTimeout(() => {
      lastTs = performance.now();
      rafId = requestAnimationFrame(tick);
    }, 80);

    return () => {
      window.clearTimeout(startTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [open, isEditing, sourceCanvas]);

  if (!open || !sourceCanvas) return null;

  const scaleFactor = Math.max(1, sourceCanvas.width / 420);
  const hitTol = Math.round(14 * scaleFactor);

  const toCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const displayRatio = Math.max(0.1, rect.width / Math.max(1, el.width));
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * el.width,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * el.height,
      displayRatio,
    };
  };

  const commitTextAnnotation = (overrideDraft?: typeof textDraft) => {
    const active = overrideDraft ?? textDraft;
    if (!active) return;
    const val = active.value.replace(/\s+$/, '');
    if (val.trim()) {
      const next = [
        ...annotations,
        {
          type: 'text' as const,
          x: active.x,
          y: active.y,
          text: val,
          color,
          size: Math.round(textSize * scaleFactor),
        },
      ];
      commitAnnotations(next, next.length - 1);
    }
    setTextDraft(null);
  };

  const findDraggableHitIndex = (x: number, y: number): number | null => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return null;

    if (tool === 'select') {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTestAnnotation(annotations[i], x, y, ctx, hitTol, true)) {
          return i;
        }
      }
      return null;
    }

    if (
      selectedIndex !== null &&
      selectedIndex >= 0 &&
      selectedIndex < annotations.length &&
      hitTestAnnotation(annotations[selectedIndex], x, y, ctx, hitTol, false)
    ) {
      return selectedIndex;
    }

    if (tool === 'text' || tool === 'step') {
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (
          annotations[i].type === tool &&
          hitTestAnnotation(annotations[i], x, y, ctx, hitTol, true)
        ) {
          return i;
        }
      }
    }
    return null;
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditing) return;

    if (textDraft) {
      commitTextAnnotation(textDraft);
      return;
    }

    const { x, y, displayRatio } = toCanvasCoords(e);

    const hitIdx = findDraggableHitIndex(x, y);
    if (hitIdx !== null) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedIndex(hitIdx);
      dragMoveRef.current = {
        pointerId: e.pointerId,
        index: hitIdx,
        startX: x,
        startY: y,
        originItem: annotations[hitIdx],
        snapshotBefore: annotations,
        moved: false,
      };
      return;
    }

    if (tool === 'select') {
      setSelectedIndex(null);
      return;
    }

    if (tool === 'step') {
      const nextStepNum = annotations.filter((a) => a.type === 'step').length + 1;
      const stepItem: AnnotationItem = {
        type: 'step',
        x,
        y,
        num: nextStepNum,
        color,
        radius: Math.round(14 * scaleFactor),
      };
      const next = [...annotations, stepItem];
      commitAnnotations(next, next.length - 1);
      return;
    }

    if (tool === 'text') {
      e.preventDefault();
      setSelectedIndex(null);
      setTextDraft({ x, y, value: '', displayRatio });
      return;
    }

    setSelectedIndex(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const scaledStroke = Math.max(2, Math.round(strokeWidth * scaleFactor));
    if (tool === 'pen') {
      setDraftItem({ type: 'pen', points: [{ x, y }], color, width: scaledStroke });
    } else if (tool === 'mosaic') {
      setDraftItem({ type: 'mosaic', x1: x, y1: y, x2: x, y2: y });
    } else {
      setDraftItem({ type: tool, x1: x, y1: y, x2: x, y2: y, color, width: scaledStroke });
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditing) return;
    const { x, y } = toCanvasCoords(e);

    const drag = dragMoveRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (Math.hypot(dx, dy) > 2) {
        drag.moved = true;
      }
      const updated = translateAnnotation(drag.originItem, dx, dy);
      setAnnotations((prev) => prev.map((it, idx) => (idx === drag.index ? updated : it)));
      return;
    }

    if (draftItem) {
      if (draftItem.type === 'pen') {
        setDraftItem({ ...draftItem, points: [...draftItem.points, { x, y }] });
      } else if (draftItem.type !== 'text' && draftItem.type !== 'step') {
        setDraftItem({ ...draftItem, x2: x, y2: y });
      }
      return;
    }

    const canGrab = findDraggableHitIndex(x, y) !== null;
    if (canGrab !== hoveredMoveTarget) {
      setHoveredMoveTarget(canGrab);
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditing) return;

    const drag = dragMoveRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (drag.moved) {
        setUndoHistory((prev) => [...prev, drag.snapshotBefore]);
        setRedoHistory([]);
      }
      dragMoveRef.current = null;
      return;
    }

    if (!draftItem) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const tooTinyRect =
      (draftItem.type === 'rect' ||
        draftItem.type === 'circle' ||
        draftItem.type === 'arrow' ||
        draftItem.type === 'mosaic') &&
      Math.hypot(draftItem.x2 - draftItem.x1, draftItem.y2 - draftItem.y1) < 4;

    if (!tooTinyRect) {
      const next = [...annotations, draftItem];
      const nextSel = isMovableItem(draftItem) ? next.length - 1 : null;
      commitAnnotations(next, nextSel);
    }
    setDraftItem(null);
  };

  const renderCleanExportCanvas = (): HTMLCanvasElement => {
    const cleanCanvas = document.createElement('canvas');
    cleanCanvas.width = sourceCanvas.width;
    cleanCanvas.height = sourceCanvas.height;
    const ctx = cleanCanvas.getContext('2d');
    if (ctx) {
      renderAllAnnotations(ctx, sourceCanvas, annotations);
    }
    return cleanCanvas;
  };

  const handleDownload = async () => {
    if (textDraft) commitTextAnnotation(textDraft);
    const cleanCanvas = renderCleanExportCanvas();
    const blob = await canvasToExportBlob(cleanCanvas, format, dpi);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.${format === 'jpeg' ? 'jpg' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify(t('captureDone'));
  };

  const handleCopyClipboard = async () => {
    if (textDraft) commitTextAnnotation(textDraft);
    const cleanCanvas = renderCleanExportCanvas();
    try {
      const pngBlob = await canvasToExportBlob(cleanCanvas, 'png', dpi);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopiedJustNow(true);
      onNotify(t('copyImageDone'));
      window.setTimeout(() => setCopiedJustNow(false), 2000);
    } catch {
      onNotify(t('copyImageFailed'));
    }
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const prevSnapshot = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, -1));
    setRedoHistory((prev) => [...prev, annotations]);
    setAnnotations(prevSnapshot);
    setSelectedIndex(null);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const nextSnapshot = redoHistory[redoHistory.length - 1];
    setRedoHistory((prev) => prev.slice(0, -1));
    setUndoHistory((prev) => [...prev, annotations]);
    setAnnotations(nextSnapshot);
    setSelectedIndex(null);
  };

  const handleClear = () => {
    if (annotations.length === 0) return;
    commitAnnotations([], null);
  };

  const toolButtons: Array<{ id: AnnotationTool; icon: typeof Square; label: string }> = [
    { id: 'select', icon: MousePointer, label: t('toolSelect') },
    { id: 'rect', icon: Square, label: t('toolRect') },
    { id: 'circle', icon: Circle, label: t('toolCircle') },
    { id: 'arrow', icon: ArrowUpRight, label: t('toolArrow') },
    { id: 'pen', icon: Pencil, label: t('toolPen') },
    { id: 'mosaic', icon: Grid2x2, label: t('toolMosaic') },
    { id: 'text', icon: Type, label: t('toolText') },
    { id: 'step', icon: Check, label: t('toolStep') },
  ];

  const cursorClass = !isEditing
    ? 'cursor-default'
    : dragMoveRef.current !== null || hoveredMoveTarget
      ? 'cursor-move'
      : tool === 'select'
        ? 'cursor-default'
        : tool === 'text'
          ? 'cursor-text'
          : 'cursor-crosshair';

  const inlineTextCssSize = textDraft
    ? Math.max(12, Math.round(textSize * scaleFactor * textDraft.displayRatio))
    : 14;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-preview-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white text-[#1D1D1F] shadow-2xl outline-none dark:border-white/[0.12] dark:bg-[#1C1C1E] dark:text-[#F5F5F7]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.08] px-5 py-3 dark:border-white/[0.1]">
          <div className="flex items-center gap-3">
            <h2 id="ts-preview-title" className="text-base font-semibold">
              {t('previewModalTitle')}
            </h2>
            <span className="rounded-full bg-[#007AFF]/12 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#0066D6] dark:bg-[#0A84FF]/20 dark:text-[#64D2FF]">
              {sourceCanvas.width} × {sourceCanvas.height} px · {dpi} DPI
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="cursor-pointer rounded-full bg-black/[0.05] p-1.5 text-[#6E6E73] hover:bg-black/10 dark:bg-white/10 dark:text-[#98989D]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left Preview / DingTalk Annotation Studio */}
          <div className="relative flex min-h-0 flex-1 flex-col bg-[#F5F5F7] dark:bg-[#0D0D0F]">
            {/* Edit Mode: DingTalk-Style 2-Row Contextual Toolbar */}
            {isEditing && (
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-black/[0.06] bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-[#1C1C1E]">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {toolButtons.map((tb) => {
                      const Icon = tb.icon;
                      const active = tool === tb.id;
                      return (
                        <button
                          key={tb.id}
                          type="button"
                          onClick={() => {
                            if (textDraft) commitTextAnnotation(textDraft);
                            setTool(tb.id);
                          }}
                          title={tb.label}
                          className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                            active
                              ? 'bg-[#007AFF] text-white'
                              : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-slate-200 dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{tb.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={undoHistory.length === 0}
                      onClick={handleUndo}
                      title={t('toolUndo')}
                      aria-label={t('toolUndo')}
                      className="cursor-pointer rounded-lg bg-[#F5F5F7] p-1.5 text-xs hover:bg-slate-200 disabled:opacity-40 dark:bg-[#2C2C2E]"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={redoHistory.length === 0}
                      onClick={handleRedo}
                      title={t('toolRedo')}
                      aria-label={t('toolRedo')}
                      className="cursor-pointer rounded-lg bg-[#F5F5F7] p-1.5 text-xs hover:bg-slate-200 disabled:opacity-40 dark:bg-[#2C2C2E]"
                    >
                      <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={annotations.length === 0}
                      onClick={handleClear}
                      title={t('toolClear')}
                      aria-label={t('toolClear')}
                      className="cursor-pointer rounded-lg bg-[#F5F5F7] p-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:bg-[#2C2C2E]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (textDraft) commitTextAnnotation(textDraft);
                        setSelectedIndex(null);
                        setIsEditing(false);
                      }}
                      className="ml-1 flex cursor-pointer items-center gap-1 rounded-lg bg-[#34C759] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#28B84D]"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('doneEditBtn')}</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Contextual Stroke / Font Size + Color Swatches right alongside tools (DingTalk style) */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F5F5F7] px-3 py-1.5 text-xs dark:bg-[#2C2C2E]">
                  {tool === 'text' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[#6E6E73] dark:text-[#98989D]">
                        {t('fontSizeLabel')}
                      </span>
                      {FONT_SIZE_OPTIONS.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setTextSize(sz)}
                          className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                            textSize === sz
                              ? 'bg-white text-[#007AFF] shadow-2xs dark:bg-[#0A84FF] dark:text-white'
                              : 'text-[#3A3A3C] hover:bg-black/[0.05] dark:text-[#E5E5EA]'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#6E6E73] dark:text-[#98989D]">
                        {t('strokeWidthLabel')}
                      </span>
                      <input
                        type="range"
                        aria-label={t('strokeWidthLabel')}
                        min={2}
                        max={10}
                        step={1}
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-24 accent-[#007AFF]"
                      />
                      <span className="w-8 font-mono text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {strokeWidth}px
                      </span>
                    </div>
                  )}

                  <div className="h-4 w-px bg-black/10 dark:bg-white/15" />

                  <div className="flex items-center gap-2">
                    {SWATCHES.map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        aria-label={sw}
                        onClick={() => setColor(sw)}
                        style={{ backgroundColor: sw }}
                        className={`h-5 w-5 cursor-pointer rounded-full transition ${
                          color === sw ? 'ring-2 ring-[#007AFF] ring-offset-2' : 'opacity-80 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Floating "编辑" button when in clean preview mode */}
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="absolute left-4 top-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] shadow-md transition hover:bg-slate-50 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              >
                <Pencil className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>{t('editBtn')}</span>
              </button>
            )}

            {/* Auto-scroll status pill for long screenshots */}
            {!isEditing && isAutoScrolling && (
              <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full border border-black/10 bg-white/95 px-3 py-1 text-xs font-medium text-[#3A3A3C] shadow-md backdrop-blur-sm dark:border-white/[0.12] dark:bg-[#1C1C1E]/95 dark:text-[#E5E5EA]">
                <Play className="h-3 w-3 text-[#007AFF] dark:text-[#0A84FF]" aria-hidden="true" />
                <span>{t('autoScrollHint')}</span>
              </div>
            )}

            {/* Scrollable Canvas Stage */}
            <div
              ref={scrollBoxRef}
              onPointerEnter={() => {
                isHoveringRef.current = true;
              }}
              onPointerLeave={() => {
                isHoveringRef.current = false;
              }}
              onWheel={() => {
                manualPauseUntilRef.current = performance.now() + 2000;
              }}
              className="relative flex flex-1 items-start justify-center overflow-auto p-5"
            >
              <div
                className="relative inline-block rounded-xl shadow-md"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                  backgroundColor: '#ffffff',
                }}
              >
                <canvas
                  ref={canvasRef}
                  onPointerDown={onCanvasPointerDown}
                  onPointerMove={onCanvasPointerMove}
                  onPointerUp={onCanvasPointerUp}
                  onPointerCancel={onCanvasPointerUp}
                  style={{
                    touchAction: isEditing ? 'none' : 'pan-y',
                    maxWidth: '460px',
                    width: '100%',
                    height: 'auto',
                  }}
                  className={`block ${cursorClass}`}
                />

                {/* DingTalk-Style Direct-on-Canvas Inline Text Input Overlay */}
                {isEditing && textDraft && (
                  <textarea
                    ref={textAreaRef}
                    rows={1}
                    placeholder={t('textPromptHint')}
                    value={textDraft.value}
                    onChange={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                      setTextDraft((prev) => (prev ? { ...prev, value: el.value } : null));
                    }}
                    onCompositionStart={() => {
                      isComposingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                      isComposingRef.current = false;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setTextDraft(null);
                        return;
                      }
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !isComposingRef.current &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        commitTextAnnotation(textDraft);
                      }
                    }}
                    onBlur={() => commitTextAnnotation(textDraft)}
                    style={{
                      left: `${(textDraft.x / sourceCanvas.width) * 100}%`,
                      top: `${(textDraft.y / sourceCanvas.height) * 100}%`,
                      fontSize: `${inlineTextCssSize}px`,
                      lineHeight: 1.2,
                      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                      fontWeight: 700,
                      color,
                      minWidth: '96px',
                      maxWidth: `calc(${Math.max(20, 100 - (textDraft.x / sourceCanvas.width) * 100)}% - 4px)`,
                    }}
                    className="absolute z-30 resize-none overflow-hidden rounded-md border-2 border-[#007AFF] bg-white/85 px-1 py-0.5 shadow-md outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Export Sidebar (Clean: Format, Download, Copy only) */}
          <div className="flex w-full shrink-0 flex-col justify-between gap-4 border-t border-black/[0.08] bg-white p-5 md:w-64 md:border-l md:border-t-0 dark:border-white/[0.1] dark:bg-[#1C1C1E]">
            <div className="space-y-4 text-xs">
              <div>
                <div className="mb-1.5 font-medium text-[#6E6E73] dark:text-[#98989D]">
                  {t('exportFormatLabel')}
                </div>
                <div className="grid grid-cols-3 rounded-xl bg-[#E5E5EA]/80 p-1 dark:bg-[#2C2C2E]">
                  {(['png', 'webp', 'jpeg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`cursor-pointer rounded-lg py-1.5 text-xs font-semibold uppercase transition ${
                        format === fmt
                          ? 'bg-white text-[#1D1D1F] shadow-xs dark:bg-[#0A84FF] dark:text-white'
                          : 'text-[#6E6E73] dark:text-[#98989D]'
                      }`}
                    >
                      {fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Comparison & Recommended Use Cases */}
              <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-3 dark:border-white/[0.1] dark:bg-[#2C2C2E]">
                <div className="mb-2 font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('formatGuideTitle')}
                </div>
                <div className="space-y-2 text-xs">
                  {(
                    [
                      { id: 'png', label: 'PNG', desc: t('formatPngDesc') },
                      { id: 'webp', label: 'WEBP', desc: t('formatWebpDesc') },
                      { id: 'jpeg', label: 'JPG', desc: t('formatJpgDesc') },
                    ] as const
                  ).map((item) => {
                    const active = format === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setFormat(item.id)}
                        className={`cursor-pointer rounded-xl border px-2.5 py-2 transition ${
                          active
                            ? 'border-[#007AFF]/40 bg-white shadow-2xs dark:border-[#0A84FF]/45 dark:bg-[#1C1C1E]'
                            : 'border-transparent bg-white/55 opacity-80 hover:opacity-100 dark:bg-[#1C1C1E]/60'
                        }`}
                      >
                        <div
                          className={`font-semibold ${
                            active
                              ? 'text-[#0066D6] dark:text-[#64D2FF]'
                              : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                          }`}
                        >
                          {item.label}
                        </div>
                        <p className="mt-0.5 leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
                          {item.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0066D6] dark:bg-[#0A84FF]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{t('downloadImageBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyClipboard()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 bg-[#F5F5F7] px-4 py-2.5 text-xs font-semibold text-[#1D1D1F] transition hover:bg-slate-200 dark:border-white/[0.12] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]"
              >
                {copiedJustNow ? (
                  <Check className="h-4 w-4 text-[#34C759]" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{t('copyImageBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
