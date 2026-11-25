import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import overlayCss from '../styles/index.css?inline';
import { SimulatorApp } from '../simulator/SimulatorApp';
import type { RuntimeRequest, RuntimeResponse } from '../shared/types';

const ROOT_ID = 'truescale-mobile-root';
const HOST_STYLE_ID = 'truescale-host-hide';
const TW_PROP_STYLE_ID = 'truescale-tw-properties';

let reactRoot: Root | null = null;
let hostContainer: HTMLElement | null = null;

function prepareShadowTailwindCss(rawCss: string): { propertyRules: string; shadowCss: string } {
  const propertyBlocks = rawCss.match(/@property\s+[^{]+\{[^}]*\}/g) ?? [];
  const shadowCss = rawCss
    .replace(/@property\s+[^{]+\{[^}]*\}/g, '')
    .replace(/:root\b/g, ':host, :root');
  return {
    propertyRules: propertyBlocks.join('\n'),
    shadowCss,
  };
}

function unmountInPlace(notifyBackground: boolean) {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (hostContainer) {
    hostContainer.remove();
    hostContainer = null;
  }
  document.getElementById(HOST_STYLE_ID)?.remove();
  document.getElementById(TW_PROP_STYLE_ID)?.remove();
  document.documentElement.classList.remove('truescale-inplace-active');

  if (notifyBackground) {
    void chrome.runtime
      .sendMessage({ type: 'GET_TAB_INFO' } satisfies RuntimeRequest)
      .then((res: RuntimeResponse<{ tabId: number | null }>) => {
        if (res?.ok && typeof res.data?.tabId === 'number') {
          return chrome.runtime.sendMessage({
            type: 'DEACTIVATE_INPLACE',
            tabId: res.data.tabId,
          } satisfies RuntimeRequest);
        }
      })
      .catch(() => {});
  }
}

function mountInPlace(deviceId?: string, openCalibration = false) {
  unmountInPlace(false);

  const { propertyRules, shadowCss } = prepareShadowTailwindCss(overlayCss);

  if (propertyRules) {
    const propStyle = document.createElement('style');
    propStyle.id = TW_PROP_STYLE_ID;
    propStyle.textContent = propertyRules;
    (document.head || document.documentElement).appendChild(propStyle);
  }

  const hideStyle = document.createElement('style');
  hideStyle.id = HOST_STYLE_ID;
  hideStyle.textContent = `
    html.truescale-inplace-active {
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    html.truescale-inplace-active > body {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(hideStyle);
  document.documentElement.classList.add('truescale-inplace-active');

  hostContainer = document.createElement('div');
  hostContainer.id = ROOT_ID;
  hostContainer.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;display:block;opacity:0;transition:opacity 90ms ease-out;';
  document.documentElement.appendChild(hostContainer);

  const shadow = hostContainer.attachShadow({ mode: 'open' });

  // Inject bundled CSS synchronously (with :host variables) so zero unstyled flash occurs
  const styleEl = document.createElement('style');
  styleEl.textContent = shadowCss;
  shadow.appendChild(styleEl);

  const mountNode = document.createElement('div');
  mountNode.style.cssText = 'width:100%;height:100%;';
  shadow.appendChild(mountNode);

  reactRoot = createRoot(mountNode);
  reactRoot.render(
    <StrictMode>
      <SimulatorApp
        inPlace
        initialDeviceId={deviceId}
        initialOpenCalibration={openCalibration}
        onExitInPlace={() => unmountInPlace(true)}
      />
    </StrictMode>,
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (hostContainer) {
        hostContainer.style.opacity = '1';
      }
    });
  });
}

const win = window as unknown as Record<string, unknown>;
if (!win.__TRUESCALE_INPLACE_LISTENER__) {
  win.__TRUESCALE_INPLACE_LISTENER__ = true;

  window.addEventListener('beforeunload', () => {
    if (hostContainer && hostContainer.isConnected) {
      void chrome.runtime.sendMessage({ type: 'CLEAR_SIMULATOR_RULES' }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'TS_PING_INPLACE') {
      sendResponse({ ok: true, mounted: Boolean(hostContainer && hostContainer.isConnected) });
      return true;
    }
    if (msg.type === 'TS_MOUNT_INPLACE') {
      mountInPlace(
        typeof msg.deviceId === 'string' ? msg.deviceId : undefined,
        Boolean(msg.openCalibration),
      );
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'TS_UNMOUNT_INPLACE') {
      unmountInPlace(false);
      sendResponse({ ok: true });
      return true;
    }
  });
}
