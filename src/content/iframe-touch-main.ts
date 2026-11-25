(() => {
  // Run ONLY in TrueScale's designated direct child mobile preview iframe
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
  if (win.__TRUESCALE_TOUCH_MAIN__) {
    return;
  }
  win.__TRUESCALE_TOUCH_MAIN__ = true;

  try {
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
      configurable: true,
      get: () => 5,
    });
  } catch {
    // Ignore if locked by browser environment
  }

  if (!('ontouchstart' in window)) {
    try {
      (window as unknown as { ontouchstart: null }).ontouchstart = null;
    } catch {
      // Ignore
    }
  }

  // Emulate touch-first media queries: (pointer: coarse), (hover: none)
  if (typeof window.matchMedia === 'function') {
    const origMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      const mql = origMatchMedia(query);
      const q = query.toLowerCase().replace(/\s+/g, '');
      let override: boolean | null = null;
      if (q.includes('(pointer:coarse)') || q.includes('(any-pointer:coarse)')) {
        override = true;
      } else if (q.includes('(pointer:fine)')) {
        override = false;
      } else if (q.includes('(hover:none)') || q.includes('(any-hover:none)')) {
        override = true;
      } else if (q.includes('(hover:hover)')) {
        override = false;
      }
      if (override === null) {
        return mql;
      }
      return new Proxy(mql, {
        get(target, prop, receiver) {
          if (prop === 'matches') return override;
          const val = Reflect.get(target, prop, receiver);
          return typeof val === 'function' ? val.bind(target) : val;
        },
      });
    };
  }
})();
