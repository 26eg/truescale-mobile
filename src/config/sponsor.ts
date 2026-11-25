/**
 * Static, zero-remote-script donation / sponsor configuration.
 * Set `enabled: false` if submitting to an environment that prohibits external links.
 * Fill any URL or place local QR images in `public/sponsor/` to activate them.
 */
export interface SponsorConfig {
  enabled: boolean;
  buyMeACoffeeUrl: string;
  kofiUrl: string;
  afdianUrl: string;
  wechatQrPath: string;
  alipayQrPath: string;
}

export const SPONSOR_CONFIG: SponsorConfig = {
  enabled: true,
  buyMeACoffeeUrl: '',
  kofiUrl: 'https://ko-fi.com/at26eg',
  afdianUrl: 'https://afdian.com/a/at26eg',
  wechatQrPath: '',
  alipayQrPath: '',
};
