(() => {
  // Strictly operate ONLY inside TrueScale's designated direct child mobile preview iframe
  const isTrueScaleViewport = (): boolean => {
    if (window === window.top || window.parent !== window.top) return false;
    if (window.name === '__TRUESCALE_MOBILE_VIEWPORT__') return true;
    try {
      return window.frameElement?.getAttribute('data-ts-viewport') === 'true';
    } catch {
      return false;
    }
  };

  if (!isTrueScaleViewport()) {
    return;
  }

  const win = window as unknown as Record<string, unknown>;
  if (win.__TRUESCALE_BRIDGE_ACTIVE__) {
    return;
  }
  win.__TRUESCALE_BRIDGE_ACTIVE__ = true;

  // Hide desktop scrollbars, disable mouse text selection, and apply touch fingertip cursor
  const TOUCH_CURSOR_SVG = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' +
      '<circle cx="13" cy="13" r="10.5" fill="rgba(120,120,128,0.28)" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/>' +
      '<circle cx="13" cy="13" r="3" fill="rgba(0,122,255,0.75)"/>' +
      '</svg>',
  );

  const STYLE_ID = 'truescale-mobile-touch-style';
  const ensureTouchStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const targetParent = document.head || document.documentElement;
    if (!targetParent) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html, body, * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        cursor: url("data:image/svg+xml,${TOUCH_CURSOR_SVG}") 13 13, auto !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        -webkit-user-drag: none !important;
        -webkit-tap-highlight-color: rgba(0, 122, 255, 0.16);
      }
      input, textarea, select, [contenteditable="true"], [contenteditable="true"] * {
        cursor: text !important;
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `;
    targetParent.appendChild(style);
  };

  ensureTouchStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureTouchStyle, { once: true });
    window.addEventListener('load', ensureTouchStyle, { once: true });
  }

  // Lock page against pinch / Ctrl+wheel / keyboard zoom shortcuts
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    },
    { passive: false, capture: true },
  );

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '_', '0'].includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        window.parent.postMessage({ type: 'TS_REQUEST_TOP_RELOAD' }, '*');
      }
    },
    { capture: true },
  );

  const isTextInputTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') {
      return true;
    }
    return Boolean(target.closest('[contenteditable="true"]'));
  };

  // Block browser drag-and-drop & accidental text selection during finger swipes
  window.addEventListener(
    'dragstart',
    (e: DragEvent) => {
      e.preventDefault();
    },
    { capture: true },
  );

  window.addEventListener(
    'selectstart',
    (e: Event) => {
      if (!isTextInputTarget(e.target)) {
        e.preventDefault();
      }
    },
    { capture: true },
  );

  // Bidirectional Touch & Momentum Scroll Engine
  let isPointerDown = false;
  let hasDragged = false;
  let suppressNextClick = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocityX = 0;
  let velocityY = 0;
  let momentumRaf: number | null = null;
  let activeTarget: EventTarget | null = null;
  let activeScrollX: Element | null = null;
  let activeScrollY: Element | null = null;

  const findAxisScrollers = (target: EventTarget | null): { x: Element; y: Element } => {
    const rootScroller = document.scrollingElement || document.documentElement || document.body;
    let foundX: Element | null = null;
    let foundY: Element | null = null;

    let el = target instanceof Element ? target : document.documentElement;
    while (el && el !== document.documentElement && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (
        !foundX &&
        (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay') &&
        el.scrollWidth > el.clientWidth + 2
      ) {
        foundX = el;
      }
      if (
        !foundY &&
        (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
        el.scrollHeight > el.clientHeight + 2
      ) {
        foundY = el;
      }
      if (foundX && foundY) break;
      el = el.parentElement as Element;
    }

    return {
      x: foundX || rootScroller,
      y: foundY || rootScroller,
    };
  };

  const dispatchSyntheticTouch = (
    type: 'touchstart' | 'touchmove' | 'touchend',
    target: EventTarget | null,
    clientX: number,
    clientY: number,
    screenX: number,
    screenY: number,
  ): boolean => {
    if (!target || typeof Touch === 'undefined' || typeof TouchEvent === 'undefined') {
      return false;
    }
    try {
      const touch = new Touch({
        identifier: 1,
        target,
        clientX,
        clientY,
        pageX: clientX + window.scrollX,
        pageY: clientY + window.scrollY,
        screenX,
        screenY,
        radiusX: 14,
        radiusY: 14,
        force: type === 'touchend' ? 0 : 1,
      });
      const activeList = type === 'touchend' ? [] : [touch];
      const evt = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: activeList,
        targetTouches: activeList,
        changedTouches: [touch],
      });
      target.dispatchEvent(evt);
      return evt.defaultPrevented;
    } catch {
      return false;
    }
  };

  const stopMomentum = () => {
    if (momentumRaf !== null) {
      cancelAnimationFrame(momentumRaf);
      momentumRaf = null;
    }
  };

  const scrollInstant = (scrollXEl: Element, scrollYEl: Element, dx: number, dy: number) => {
    if (scrollXEl === scrollYEl) {
      scrollXEl.scrollBy({ left: dx, top: dy, behavior: 'instant' as ScrollBehavior });
      return;
    }
    if (dx !== 0) {
      scrollXEl.scrollBy({ left: dx, behavior: 'instant' as ScrollBehavior });
    }
    if (dy !== 0) {
      scrollYEl.scrollBy({ top: dy, behavior: 'instant' as ScrollBehavior });
    }
  };

  const startMomentum = (scrollXEl: Element, scrollYEl: Element, vx: number, vy: number) => {
    stopMomentum();
    let curVx = vx;
    let curVy = vy;
    let prevTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(32, Math.max(8, now - prevTs));
      prevTs = now;
      const friction = Math.pow(0.92, dt / 16);
      curVx *= friction;
      curVy *= friction;

      if (Math.hypot(curVx, curVy) < 0.08) {
        momentumRaf = null;
        return;
      }
      scrollInstant(scrollXEl, scrollYEl, -curVx * dt, -curVy * dt);
      momentumRaf = requestAnimationFrame(step);
    };
    momentumRaf = requestAnimationFrame(step);
  };

  window.addEventListener(
    'mousedown',
    (e: MouseEvent) => {
      if (e.button !== 0 || isTextInputTarget(e.target)) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      stopMomentum();

      isPointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = performance.now();
      velocityX = 0;
      velocityY = 0;
      activeTarget = e.target;

      const scrollers = findAxisScrollers(e.target);
      activeScrollX = scrollers.x;
      activeScrollY = scrollers.y;

      dispatchSyntheticTouch('touchstart', activeTarget, e.clientX, e.clientY, e.screenX, e.screenY);
    },
    { passive: false, capture: true },
  );

  window.addEventListener(
    'mousemove',
    (e: MouseEvent) => {
      if (!isPointerDown) return;
      const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (totalDist > 4) {
        hasDragged = true;
        window.getSelection()?.removeAllRanges();
      }

      const prevented = dispatchSyntheticTouch(
        'touchmove',
        activeTarget,
        e.clientX,
        e.clientY,
        e.screenX,
        e.screenY,
      );

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const moveX = e.clientX - lastX;
      const moveY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;

      if (!hasDragged || prevented || !activeScrollX || !activeScrollY) return;

      velocityX = velocityX * 0.35 + (moveX / dt) * 0.65;
      velocityY = velocityY * 0.35 + (moveY / dt) * 0.65;
      scrollInstant(activeScrollX, activeScrollY, -moveX, -moveY);
    },
    { passive: true, capture: true },
  );

  const endTouch = (e: MouseEvent) => {
    if (!isPointerDown) return;
    dispatchSyntheticTouch('touchend', activeTarget, e.clientX, e.clientY, e.screenX, e.screenY);

    if (hasDragged) {
      suppressNextClick = true;
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 90);

      if (activeScrollX && activeScrollY && Math.hypot(velocityX, velocityY) > 0.22) {
        startMomentum(activeScrollX, activeScrollY, velocityX, velocityY);
      }
    }

    isPointerDown = false;
    hasDragged = false;
    activeTarget = null;
    activeScrollX = null;
    activeScrollY = null;
  };

  window.addEventListener('mouseup', endTouch, { passive: true, capture: true });
  window.addEventListener('mouseleave', endTouch, { passive: true });

  window.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // Scroll & Fixed/Dynamic-Sticky Coordination for Screenshots
  const hiddenElements: Array<{ el: HTMLElement; prevVisibility: string; prevOpacity: string }> =
    [];
  const hiddenElementSet = new WeakSet<HTMLElement>();

  const hideFixedAndStickyElements = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const all = document.querySelectorAll<HTMLElement>('*');
    for (const el of all) {
      if (hiddenElementSet.has(el)) continue;
      const tag = el.tagName;
      if (tag === 'HTML' || tag === 'BODY' || tag === 'SCRIPT' || tag === 'STYLE') continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const pos = style.position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      // Never hide huge full-page wrappers
      if (rect.height > vh * 0.72) continue;

      // For sticky elements, hide once they are pinned near the viewport top or bottom edge
      if (pos === 'sticky' && rect.top > 8 && rect.bottom < vh - 8) continue;

      hiddenElementSet.add(el);
      hiddenElements.push({
        el,
        prevVisibility: el.style.visibility,
        prevOpacity: el.style.opacity,
      });
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
    }
  };

  const restoreFixedElements = () => {
    while (hiddenElements.length > 0) {
      const item = hiddenElements.pop()!;
      hiddenElementSet.delete(item.el);
      if (item.prevVisibility) {
        item.el.style.visibility = item.prevVisibility;
      } else {
        item.el.style.removeProperty('visibility');
      }
      if (item.prevOpacity) {
        item.el.style.opacity = item.prevOpacity;
      } else {
        item.el.style.removeProperty('opacity');
      }
    }
  };

  const findPrimaryScroller = (): Element => {
    const rootScroller = document.scrollingElement || document.documentElement || document.body;
    const rootOverflow = rootScroller.scrollHeight - (rootScroller.clientHeight || window.innerHeight);
    if (rootOverflow > 8) {
      return rootScroller;
    }

    let bestEl: Element = rootScroller;
    let bestDelta = rootOverflow;
    const minW = window.innerWidth * 0.5;
    const minH = window.innerHeight * 0.45;
    const candidates = document.querySelectorAll<HTMLElement>('main, section, div');

    for (const el of candidates) {
      const delta = el.scrollHeight - el.clientHeight;
      if (delta <= 16) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < minW || rect.height < minH) continue;
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        if (delta > bestDelta) {
          bestDelta = delta;
          bestEl = el;
        }
      }
    }
    return bestEl;
  };

  let activeScroller: Element | null = null;

  const waitFrames = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === 'TS_MSG_NAV_HISTORY') {
      const delta = Number(data.delta);
      if (delta < 0) {
        window.history.back();
      } else if (delta > 0) {
        window.history.forward();
      }
      return;
    }

    if (data.type === 'TS_MSG_RELOAD_VIEWPORT') {
      if (typeof data.reqId === 'string') {
        window.parent.postMessage(
          { type: 'TS_MSG_REPLY', reqId: data.reqId, payload: { ok: true } },
          '*',
        );
      }
      window.location.reload();
      return;
    }

    if (data.type === 'TS_MSG_SCROLL_EDGE') {
      stopMomentum();
      const scroller = findPrimaryScroller();
      const targetTop = data.edge === 'bottom' ? scroller.scrollHeight : 0;
      scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
      return;
    }

    if (typeof data.reqId !== 'string') return;

    const reply = (payload: unknown) => {
      window.parent.postMessage({ type: 'TS_MSG_REPLY', reqId: data.reqId, payload }, '*');
    };

    if (data.type === 'TS_MSG_GET_SCROLL') {
      activeScroller = findPrimaryScroller();
      const isRoot =
        activeScroller === document.scrollingElement ||
        activeScroller === document.documentElement ||
        activeScroller === document.body;
      const clientHeight = isRoot
        ? window.innerHeight || activeScroller.clientHeight
        : activeScroller.clientHeight;
      const scrollHeight = activeScroller.scrollHeight;
      const scrollY = activeScroller.scrollTop;
      const maxScrollY = Math.max(0, scrollHeight - clientHeight);
      reply({
        ok: true,
        scrollHeight,
        clientHeight,
        scrollY,
        maxScrollY,
        isWindowScrollable: maxScrollY > 8,
      });
      return;
    }

    if (data.type === 'TS_MSG_SCROLL_TO') {
      (async () => {
        if (!data.hideFixed) {
          restoreFixedElements();
        }
        const scroller = activeScroller || findPrimaryScroller();
        scroller.scrollTo({ top: data.y, behavior: 'instant' as ScrollBehavior });
        await waitFrames();
        if (data.hideFixed) {
          hideFixedAndStickyElements();
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        const isRoot =
          scroller === document.scrollingElement ||
          scroller === document.documentElement ||
          scroller === document.body;
        reply({
          ok: true,
          actualY: scroller.scrollTop,
          scrollHeight: scroller.scrollHeight,
          clientHeight: isRoot ? window.innerHeight || scroller.clientHeight : scroller.clientHeight,
        });
      })();
      return;
    }

    if (data.type === 'TS_MSG_RESTORE_SCROLL') {
      (async () => {
        restoreFixedElements();
        const scroller = activeScroller || findPrimaryScroller();
        scroller.scrollTo({ top: data.y ?? 0, behavior: 'instant' as ScrollBehavior });
        activeScroller = null;
        await waitFrames();
        reply({ ok: true });
      })();
    }
  });
})();
