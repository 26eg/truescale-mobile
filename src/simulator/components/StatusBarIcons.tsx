/**
 * 100% original geometric SVG status-bar & security glyphs tailored for iOS and Android frames.
 * Built without third-party icon fonts or trademarked brand logos.
 */

export function IosSignalIcon() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
      <rect x="0.5" y="7.5" width="3" height="3.5" rx="1" />
      <rect x="4.8" y="5.5" width="3" height="5.5" rx="1" />
      <rect x="9.1" y="3" width="3" height="8" rx="1" />
      <rect x="13.4" y="0.5" width="3" height="10.5" rx="1" />
    </svg>
  );
}

export function AndroidSignalIcon() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor" aria-hidden="true">
      <path d="M12.2 0.8C12.2 0.35 11.65 0.15 11.35 0.45L0.55 10.15C0.2 10.45 0.42 11 0.88 11H11.5C11.9 11 12.2 10.7 12.2 10.3V0.8Z" />
    </svg>
  );
}

export function SolidWifiIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
      <path
        d="M1.2 3.8C4.8 0.65 10.2 0.65 13.8 3.8"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path
        d="M3.7 6.5C5.9 4.55 9.1 4.55 11.3 6.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="9.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function IosBatteryIcon() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
      <rect
        x="0.75"
        y="0.75"
        width="20.5"
        height="10.5"
        rx="3.2"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.2"
      />
      <rect x="2.3" y="2.3" width="15.8" height="7.4" rx="1.8" fill="currentColor" />
      <path
        d="M22.6 4.1C23.55 4.25 24.1 4.95 24.1 6C24.1 7.05 23.55 7.75 22.6 7.9V4.1Z"
        fill="currentColor"
        fillOpacity="0.45"
      />
    </svg>
  );
}

export function AndroidBatteryIcon() {
  return (
    <svg width="10" height="13" viewBox="0 0 10 13" fill="currentColor" aria-hidden="true">
      <rect x="3" y="0.5" width="4" height="1.4" rx="0.5" fillOpacity="0.65" />
      <rect x="1" y="2.2" width="8" height="10.3" rx="1.6" />
    </svg>
  );
}

export function HttpsLockIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M2.6 5V3.7C2.6 2.35 3.65 1.3 5 1.3C6.35 1.3 7.4 2.35 7.4 3.7V5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <rect x="1.5" y="5" width="7" height="5.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}
