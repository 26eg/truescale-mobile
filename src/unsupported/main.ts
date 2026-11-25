import { resolveLocale, isRtlLocale } from '../shared/i18n';
import type { LanguageSetting } from '../shared/types';

const MESSAGES = {
  zh_CN: {
    title: '🚫换个页面再试试吧～',
    desc: '浏览器系统页或商店页面受安全策略限制，暂不支持扩展程序预览。请先打开任意普通网站（如电商商品页或常规网页）后再点击图标。',
  },
  en: {
    title: '🚫 Try another page~',
    desc: 'Browser system or store pages restrict extensions by policy. Please open any regular website first and click the icon again.',
  },
  ar: {
    title: '🚫 جرّب صفحة أخرى~',
    desc: 'تقيد سياسات المتصفح عمل الإضافات في صفحات النظام أو المتجر. يرجى فتح موقع ويب عادي أولاً ثم النقر على الأيقونة.',
  },
  fr: {
    title: '🚫 Essayez sur une autre page~',
    desc: 'Les pages système ou boutique du navigateur bloquent les extensions par sécurité. Ouvrez un site web normal puis cliquez à nouveau.',
  },
  ru: {
    title: '🚫 Попробуйте другую страницу~',
    desc: 'Системные страницы и магазин расширений защищены политикой браузера. Откройте любой обычный сайт и нажмите на значок снова.',
  },
  es: {
    title: '🚫 Prueba en otra página~',
    desc: 'Las páginas del sistema o la tienda restringen las extensiones por seguridad. Abre cualquier sitio web normal e inténtalo de nuevo.',
  },
} as const;

async function init() {
  let langSetting: LanguageSetting = 'auto';
  try {
    const res = await chrome.storage?.local?.get('ts_settings_v1');
    const saved = res?.ts_settings_v1?.language;
    if (typeof saved === 'string') langSetting = saved as LanguageSetting;
  } catch {
    // Ignore
  }
  const locale = resolveLocale(langSetting);
  document.documentElement.lang = locale === 'zh_CN' ? 'zh-CN' : locale;
  document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  const copy = MESSAGES[locale] ?? MESSAGES.en;
  const titleEl = document.getElementById('title');
  const descEl = document.getElementById('desc');
  if (titleEl) titleEl.textContent = copy.title;
  if (descEl) descEl.textContent = copy.desc;
}

void init();
