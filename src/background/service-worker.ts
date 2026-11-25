import { PRESET_DEVICES } from '../config/devices';
import { getCustomDevices, getSettings } from '../shared/storage';
import type { DeviceProfile, RuntimeRequest, RuntimeResponse } from '../shared/types';
import { isSupportedPreviewUrl } from '../shared/url';

type DnrResourceType = chrome.declarativeNetRequest.ResourceType;
type DnrActionType = chrome.declarativeNetRequest.RuleActionType;
type DnrHeaderOp = chrome.declarativeNetRequest.HeaderOperation;

const ALL_SUBRESOURCE_TYPES = [
  'sub_frame',
  'xmlhttprequest',
  'script',
  'image',
  'stylesheet',
  'font',
  'media',
  'other',
] as DnrResourceType[];

const ACTION_MODIFY_HEADERS = 'modifyHeaders' as DnrActionType;
const OP_SET = 'set' as DnrHeaderOp;
const OP_REMOVE = 'remove' as DnrHeaderOp;

const activeSimulatorTabs = new Set<number>();

function getRuleIdsForTab(tabId: number): [number, number] {
  const base = (Math.abs(tabId) % 100_000_000) * 10;
  return [base + 1, base + 2];
}

async function clearRulesForTab(tabId: number): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const [r1, r2] = getRuleIdsForTab(tabId);
  const removeRuleIds = existing
    .filter((rule) => rule.id === r1 || rule.id === r2 || rule.condition.tabIds?.includes(tabId))
    .map((rule) => rule.id);

  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds });
  }
}

async function applySimulatorRulesForTab(tabId: number, device: DeviceProfile): Promise<void> {
  await clearRulesForTab(tabId);
  const [frameStripId, uaModifyId] = getRuleIdsForTab(tabId);

  const addRules: chrome.declarativeNetRequest.Rule[] = [
    {
      id: frameStripId,
      priority: 1,
      action: {
        type: ACTION_MODIFY_HEADERS,
        responseHeaders: [
          { header: 'x-frame-options', operation: OP_REMOVE },
          { header: 'frame-options', operation: OP_REMOVE },
          { header: 'content-security-policy', operation: OP_REMOVE },
          { header: 'content-security-policy-report-only', operation: OP_REMOVE },
        ],
      },
      condition: {
        tabIds: [tabId],
        resourceTypes: ['sub_frame'] as DnrResourceType[],
      },
    },
    {
      id: uaModifyId,
      priority: 2,
      action: {
        type: ACTION_MODIFY_HEADERS,
        requestHeaders: [
          { header: 'user-agent', operation: OP_SET, value: device.userAgent },
          { header: 'sec-ch-ua-mobile', operation: OP_SET, value: device.secChUaMobile },
          { header: 'sec-ch-ua-platform', operation: OP_SET, value: device.secChUaPlatform },
          { header: 'sec-ch-ua-model', operation: OP_SET, value: device.secChUaModel },
        ],
      },
      condition: {
        tabIds: [tabId],
        resourceTypes: ALL_SUBRESOURCE_TYPES,
      },
    },
  ];

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [frameStripId, uaModifyId],
    addRules,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function lockTabZoom(tabId: number): Promise<void> {
  await chrome.tabs.setZoomSettings(tabId, { mode: 'manual', scope: 'per-tab' }).catch(() => {});
  const initialZoom = await chrome.tabs.getZoom(tabId).catch(() => 1);
  if (Math.abs(initialZoom - 1) > 0.005) {
    await chrome.tabs.setZoom(tabId, 1).catch(() => {});
    for (let i = 0; i < 10; i++) {
      await sleep(30);
      const current = await chrome.tabs.getZoom(tabId).catch(() => 1);
      if (Math.abs(current - 1) <= 0.005) break;
    }
    await sleep(40);
  }
}

async function activateInPlace(
  tabId: number,
  device: DeviceProfile,
  openCalibration = false,
): Promise<void> {
  activeSimulatorTabs.add(tabId);
  await lockTabZoom(tabId);
  await applySimulatorRulesForTab(tabId, device);

  let alreadyLoaded = false;
  try {
    const pong = (await chrome.tabs.sendMessage(
      tabId,
      { type: 'TS_PING_INPLACE' },
      { frameId: 0 },
    )) as { ok?: boolean } | undefined;
    alreadyLoaded = Boolean(pong?.ok);
  } catch {
    alreadyLoaded = false;
  }

  if (!alreadyLoaded) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/inplace-overlay.js'],
    });
  }

  await chrome.tabs.sendMessage(
    tabId,
    { type: 'TS_MOUNT_INPLACE', deviceId: device.id, openCalibration: Boolean(openCalibration) },
    { frameId: 0 },
  );
}

async function deactivateInPlace(tabId: number): Promise<void> {
  activeSimulatorTabs.delete(tabId);
  await clearRulesForTab(tabId);
  await chrome.tabs.setZoomSettings(tabId, { mode: 'automatic' }).catch(() => {});
  await chrome.tabs
    .sendMessage(tabId, { type: 'TS_UNMOUNT_INPLACE' }, { frameId: 0 })
    .catch(() => {});
}

async function syncActionForTab(tabId: number, url?: string): Promise<void> {
  if (!chrome.action) return;
  const supported = isSupportedPreviewUrl(url);
  await chrome.action
    .setPopup({ tabId, popup: supported ? '' : '/unsupported.html' })
    .catch(() => {});
  await chrome.action
    .setIcon({
      tabId,
      path: supported
        ? {
            16: '/icons/icon16.png',
            32: '/icons/icon32.png',
            48: '/icons/icon48.png',
            128: '/icons/icon128.png',
          }
        : {
            16: '/icons/icon16-gray.png',
            32: '/icons/icon32-gray.png',
            48: '/icons/icon48-gray.png',
            128: '/icons/icon128-gray.png',
          },
    })
    .catch((err) => {
      const msg = String(err?.message ?? err ?? '');
      if (!msg.includes('No tab with id')) {
        console.warn('[TrueScale] Failed to update action icon:', err);
      }
    });
}

async function syncAllOpenTabsAction(): Promise<void> {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  await Promise.all(
    tabs.map((tab) =>
      typeof tab.id === 'number'
        ? syncActionForTab(tab.id, tab.url ?? tab.pendingUrl)
        : Promise.resolve(),
    ),
  );
}

void syncAllOpenTabsAction();

chrome.runtime.onInstalled?.addListener(() => {
  void syncAllOpenTabsAction();
});

chrome.runtime.onStartup?.addListener(() => {
  void syncAllOpenTabsAction();
});

chrome.tabs.onCreated?.addListener((tab) => {
  if (typeof tab.id === 'number') {
    void syncActionForTab(tab.id, tab.pendingUrl ?? tab.url);
  }
});

chrome.tabs.onActivated?.addListener((info) => {
  void chrome.tabs
    .get(info.tabId)
    .then((tab) => syncActionForTab(info.tabId, tab.url ?? tab.pendingUrl))
    .catch(() => {});
});

chrome.tabs.onZoomChange.addListener((info) => {
  if (activeSimulatorTabs.has(info.tabId) && Math.abs(info.newZoomFactor - 1) > 0.001) {
    void chrome.tabs.setZoom(info.tabId, 1).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeSimulatorTabs.delete(tabId);
  void clearRulesForTab(tabId).catch(() => {});
});

// Keep action icon/popup synced; only clear simulation rules when top frame genuinely reloads/unloads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const nextUrl = changeInfo.url ?? tab.url ?? tab.pendingUrl;
  if (changeInfo.url !== undefined || changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    void syncActionForTab(tabId, nextUrl);
  }
  if (activeSimulatorTabs.has(tabId) && changeInfo.status === 'loading') {
    void chrome.tabs
      .sendMessage(tabId, { type: 'TS_PING_INPLACE' }, { frameId: 0 })
      .then((pong: { ok?: boolean; mounted?: boolean } | undefined) => {
        if (!pong?.mounted) {
          activeSimulatorTabs.delete(tabId);
          void clearRulesForTab(tabId).catch(() => {});
          void chrome.tabs.setZoomSettings(tabId, { mode: 'automatic' }).catch(() => {});
        }
      })
      .catch(() => {
        activeSimulatorTabs.delete(tabId);
        void clearRulesForTab(tabId).catch(() => {});
        void chrome.tabs.setZoomSettings(tabId, { mode: 'automatic' }).catch(() => {});
      });
  }
});

// Direct 1-click toggle from the extension icon without opening a popup
chrome.action?.onClicked?.addListener(async (tab) => {
  if (!tab.id || !isSupportedPreviewUrl(tab.url)) {
    if (tab.id) {
      await syncActionForTab(tab.id, tab.url);
    }
    return;
  }

  let isMounted = false;
  try {
    const pong = (await chrome.tabs.sendMessage(
      tab.id,
      { type: 'TS_PING_INPLACE' },
      { frameId: 0 },
    )) as { ok?: boolean; mounted?: boolean } | undefined;
    isMounted = Boolean(pong?.mounted);
  } catch {
    isMounted = false;
  }

  if (isMounted) {
    await deactivateInPlace(tab.id);
    return;
  }

  const [settings, customDevices] = await Promise.all([getSettings(), getCustomDevices()]);
  const allDevices = [...PRESET_DEVICES, ...customDevices];
  const device = allDevices.find((d) => d.id === settings.defaultDeviceId) ?? PRESET_DEVICES[0];
  await activateInPlace(tab.id, device, false);
});

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeRequest,
    sender,
    sendResponse: (response: RuntimeResponse) => void,
  ) => {
    (async () => {
      switch (message.type) {
        case 'ACTIVATE_INPLACE': {
          await activateInPlace(message.tabId, message.device, Boolean(message.openCalibration));
          return { ok: true, data: null } satisfies RuntimeResponse;
        }
        case 'DEACTIVATE_INPLACE': {
          await deactivateInPlace(message.tabId);
          return { ok: true, data: null } satisfies RuntimeResponse;
        }
        case 'GET_TAB_INFO': {
          return {
            ok: true,
            data: {
              tabId: sender.tab?.id ?? null,
              windowId: sender.tab?.windowId ?? null,
            },
          } satisfies RuntimeResponse;
        }
        case 'CAPTURE_VISIBLE_TAB': {
          const dataUrl = await chrome.tabs.captureVisibleTab(message.windowId, {
            format: 'png',
          });
          return { ok: true, data: dataUrl } satisfies RuntimeResponse;
        }
        case 'APPLY_SIMULATOR_RULES': {
          activeSimulatorTabs.add(message.tabId);
          await lockTabZoom(message.tabId);
          await applySimulatorRulesForTab(message.tabId, message.device);
          return { ok: true, data: null } satisfies RuntimeResponse;
        }
        case 'CLEAR_SIMULATOR_RULES': {
          const targetTabId = message.tabId ?? sender.tab?.id;
          if (typeof targetTabId === 'number') {
            activeSimulatorTabs.delete(targetTabId);
            await clearRulesForTab(targetTabId);
            await chrome.tabs.setZoomSettings(targetTabId, { mode: 'automatic' }).catch(() => {});
          }
          return { ok: true, data: null } satisfies RuntimeResponse;
        }
      }
    })()
      .then((res) => sendResponse(res))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error: msg });
      });

    return true;
  },
);
