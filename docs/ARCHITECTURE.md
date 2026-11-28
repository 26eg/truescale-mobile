# Architecture Overview

## 1. Core Design Principle: In-Place Shadow DOM Overlay & Physical Scale Decoupling

Desktop monitors vary dramatically in CSS pixel density (from ~3.7 px/mm on standard 24" 1080p monitors to ~5.0 px/mm on 14" Retina MacBooks or 4K macOS HiDPI scaled 1920×1080 displays). Resizing a browser window directly or calling `chrome.tabs.setZoom()` alters CSS media-query breakpoints.

In `v1.0.1`, TrueScale Mobile activates directly via `chrome.action.onClicked` (on supported `http/https` pages) and switches automatically to grayscale icons (root-absolute `/icons/icon*-gray.png` paths including 128px) + an explanatory `unsupported.html` popup on restricted system/store tabs:
1. **Resilient Action Toggle & Reload Isolation**: `service-worker.ts` distinguishes iframe reloads (keeping tab DNR mobile UA rules alive across portrait/landscape, device-adjacent quick-nav reload, and in-iframe search navigation) from genuine top-level page reloads via `frameId: 0` ping verification + `beforeunload` cleanup (`CLEAR_SIMULATOR_RULES`). `chrome.tabs.onActivated` & `onUpdated` sync colorful vs grayscale action icons and `unsupported.html` popup.
2. **Responsive Multi-Row Toolbar Safe Stacking, Device-Adjacent Quick Nav & 100% Complete UN 6-Language RTL Support (`>= 12px`)**: `SideTipsStack` and `RightStagePanel` are positioned `absolute top-3` inside the `flex-1` stage wrapper (`max-h-[calc(100%-1.5rem)]`) rather than fixed to `top-16`, so even when `<Toolbar />` wraps to 2 or 3 rows on narrow browser windows, the top bar never clips or overlaps the side drawers, while `DeviceStage` adds extra top inset (`pt-14`) at ultra-narrow widths to clear collapsed pills. Complete native localization spans all 6 UN languages (`zh_CN`, `en`, `ar` RTL, `fr`, `ru`, `es`, guarded by `tests/i18n.test.ts`), `FeatureGuideOverlay` includes a plain-language "why calibrate?" explanation when uncalibrated, and Settings keeps theme/language/reset controls streamlined without JSON import/export clutter.
3. **Tablet Default Landscape & Stable Fit-to-Window Stage**: Selecting any `tablet` device automatically defaults to landscape orientation; `<DeviceStage>` keeps the URL bar free of browser-engine badges (`Safari`/`Chrome`) and stays mounted during device rule switches.
4. **Long-Screenshot Full Stage Sweep & Quick Annotation Studio**: `captureFullPageSnapshot` sweeps outer `stageEl` cleanly without gaps; `ScreenshotPreviewModal.tsx` adds a right-sidebar PNG/WEBP/JPG format comparison card alongside inline WYSIWYG editing and ping-pong auto-scroll preview.

## 2. Tab-Scoped Network Isolation (`service-worker.ts`)

To load mobile-targeted websites inside the in-place `<iframe>` without affecting any other browser tab (critical for Chrome Web Store compliance and cross-border multi-store browsers like Ziniao):
- `src/background/service-worker.ts` handles `ACTIVATE_INPLACE`, `DEACTIVATE_INPLACE`, `GET_TAB_INFO`, `CAPTURE_VISIBLE_TAB`, `APPLY_SIMULATOR_RULES`, and `CLEAR_SIMULATOR_RULES`.
- Session rules via `chrome.declarativeNetRequest.updateSessionRules` are **always scoped to `condition.tabIds: [tabId]`**.
- Rule 1 (`sub_frame` only): strips `X-Frame-Options`, `Frame-Options`, `Content-Security-Policy`, and `Content-Security-Policy-Report-Only`.
- Rule 2 (`sub_frame`, `xmlhttprequest`, `script`, `image`, `stylesheet`, `font`, `media`, `other`): sets mobile `User-Agent`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform`, and `Sec-CH-UA-Model`.
- `chrome.tabs.onRemoved` cleans up all session rules tied to the closed `tabId` (with deterministic ID + `getSessionRules()` scan so cleanup survives MV3 service worker restarts).

## 3. Isolated Touch & Gesture Bridge (`iframe-touch-main.ts` & `iframe-bridge.ts`)

- Built into two standalone IIFE bundles via `vite.touch-main.config.ts` and `vite.content.config.ts`.
- Strictly gated at entry by `window !== window.top && window.parent === window.top` paired with `window.name === '__TRUESCALE_MOBILE_VIEWPORT__' || window.frameElement?.getAttribute('data-ts-viewport') === 'true'` (resilient even if sites like Amazon overwrite `window.name` after search navigation), running both `iframe-touch-main.ts` and `iframe-bridge.ts` at `document_start`.
- `iframe-touch-main.ts` (`world: "MAIN"`, `document_start`): sets `navigator.maxTouchPoints = 5`, `ontouchstart`, and `(pointer: coarse)` / `(hover: none)` media query matches before page scripts initialize.
- `iframe-bridge.ts` (`ISOLATED` world, `document_start`): applies circular touch-pointer cursor, disables desktop text selection (`user-select: none !important`, `selectstart`/`dragstart` suppression, `window.getSelection()?.removeAllRanges()`), dispatches synthetic `TouchEvent`s (`touchstart` / `touchmove` / `touchend`), drives independent X/Y scrollable container detection with `behavior: 'instant'` + 60fps momentum scrolling, incrementally hides post-scroll JS-activated `fixed`/`sticky` bars during long captures (`WeakSet`-tracked across every slice), and handles `TS_MSG_GET_SCROLL` / `TS_MSG_SCROLL_TO` / `TS_MSG_RESTORE_SCROLL` / `TS_MSG_NAV_HISTORY` / `TS_MSG_SCROLL_EDGE`.

## 4. Zero-Prompt Faithful & Framed Screenshots (`screenshot.ts`)

- Captures directly at the current preview scale via `chrome.tabs.captureVisibleTab` (no temporary zoom jump/flash), with a transparent interaction shield + docked top progress bar (`role="progressbar"`, slice counter, `AbortSignal` cancel button) that never overlays the captured phone pixels.
- Framed captures (`framed-transparent` and `fullPage-framed`) temporarily hide DOM `[data-ts-cutout="true"]` markers via `withHiddenDomCutouts` so `wrapScreenInTransparentBezel` renders exactly one crisp centered camera cutout (Dynamic Island, notch, punch-hole, or edge-accurate tablet camera dot) with transparent outer corners.
