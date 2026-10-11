import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';

import { defaultLocale, locales, type Locale } from './i18n.config';
import { createTranslator, type Translator } from './translate';

type I18nContextValue = {
  locale: Locale;
  t: Translator;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

/** Локаль из настроек телефона, fallback — defaultLocale */
function detectLocale(): Locale {
  const languageTag = getLocales()[0]?.languageTag ?? '';
  const base = languageTag.split('-')[0];

  return (locales as readonly string[]).includes(base)
    ? (base as Locale)
    : defaultLocale;
}

/**
 * Провайдер i18n. Подключается один раз в _layout.tsx,
 * локаль определяется из настроек телефона.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useMemo(() => detectLocale(), []);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Текущая локаль (для форматирования дат и т.п.) */
export function useLocaleContext(): I18nContextValue {
  const context = useContext(I18nContext);

  return context ?? { locale: defaultLocale, t: createTranslator(defaultLocale) };
}
