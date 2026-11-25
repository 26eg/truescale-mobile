import { describe, expect, it } from 'vitest';
import { TRANSLATIONS, type ResolvedLocale, type TranslationKeys } from '../src/shared/i18n';

const ALL_LOCALES: ResolvedLocale[] = ['en', 'zh_CN', 'ar', 'fr', 'ru', 'es'];

// Brand names, script autonyms, and technical stack strings intentionally kept identical across locales
const UNIVERSAL_ALLOWLIST = new Set<TranslationKeys>([
  'appName',
  'langZh',
  'langEn',
  'langAr',
  'langFr',
  'langRu',
  'langEs',
  'aboutTechValue',
  'sponsorBuyMeACoffee',
  'tipsButtonLabel',
]);

// True linguistic cognates spelled identically in a specific target language
const LOCALE_COGNATES: Partial<Record<ResolvedLocale, Set<TranslationKeys>>> = {
  fr: new Set(['portrait', 'specsButtonLabel', 'exportFormatLabel', 'toolRect', 'aboutVersionLabel', 'sponsorWechat']),
  es: new Set(['tablet', 'presetMonitorUnit']),
};

describe('UN 6-language i18n completeness', () => {
  const enKeys = Object.keys(TRANSLATIONS.en) as TranslationKeys[];

  it('defines every key as a non-empty string across all 6 UN locales', () => {
    for (const locale of ALL_LOCALES) {
      const dict = TRANSLATIONS[locale];
      expect(Object.keys(dict).length).toBe(enKeys.length);
      for (const key of enKeys) {
        expect(typeof dict[key]).toBe('string');
        expect(dict[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('contains no unintended English fallback values in non-English UN locales', () => {
    for (const locale of ALL_LOCALES) {
      if (locale === 'en') continue;
      const dict = TRANSLATIONS[locale];
      const cognates = LOCALE_COGNATES[locale];
      const untranslated: string[] = [];
      for (const key of enKeys) {
        if (UNIVERSAL_ALLOWLIST.has(key) || cognates?.has(key)) continue;
        if (dict[key] === TRANSLATIONS.en[key]) {
          untranslated.push(key);
        }
      }
      expect(untranslated, `Untranslated keys in ${locale}: ${untranslated.join(', ')}`).toEqual([]);
    }
  });
});

describe('Chrome Web Store _locales manifest limits', () => {
  const localeFiles = import.meta.glob('../public/_locales/*/messages.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;

  it('keeps extName <= 45 chars and extDesc <= 132 chars across all 6 UN locales', () => {
    for (const locale of ALL_LOCALES) {
      const key = `../public/_locales/${locale}/messages.json`;
      const raw = localeFiles[key];
      expect(raw, `Missing _locales file: ${key}`).toBeTypeOf('string');
      const json = JSON.parse(raw) as {
        extName?: { message?: string };
        extDesc?: { message?: string };
      };
      const extName = json.extName?.message?.trim() ?? '';
      const extDesc = json.extDesc?.message?.trim() ?? '';

      expect(extName.length, `${locale} extName must not be empty`).toBeGreaterThan(0);
      expect(extName.length, `${locale} extName exceeds 45 chars: "${extName}"`).toBeLessThanOrEqual(45);
      expect(extDesc.length, `${locale} extDesc must not be empty`).toBeGreaterThan(0);
      expect(extDesc.length, `${locale} extDesc exceeds 132 chars: "${extDesc}"`).toBeLessThanOrEqual(132);
    }
  });
});
