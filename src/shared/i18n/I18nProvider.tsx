import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createTranslator, type Translator } from './translate';
import { defaultLocale, type Locale } from './i18n.config';
import { useLocaleStore } from './locale-store';

type I18nContextValue = {
  locale: Locale;
  t: Translator;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Провайдер i18n. Подключается один раз в _layout.tsx.
 * Локаль берется из глобального стора (locale-store): вычисляется
 * один раз при загрузке приложения по приоритету выбор юзера (TODO) →
 * системная → дефолт.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Текущая локаль (для форматирования дат и т.п.) */
export function useLocaleContext(): I18nContextValue {
  const context = useContext(I18nContext);

  return context ?? { locale: defaultLocale, t: createTranslator(defaultLocale) };
}
