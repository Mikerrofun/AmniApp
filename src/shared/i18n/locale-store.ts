import { getLocales } from 'expo-localization';
import { create } from 'zustand';

import { defaultLocale, locales, type Locale } from './i18n.config';

/**
 * Вычисляет локаль один раз при загрузке приложения. Приоритеты:
 *
 * 1. TODO(i18n): выбор юзера — когда появится переключатель языка,
 *    читать здесь сохраненный выбор (персистентное хранилище) и
 *    возвращать его до системного определения.
 * 2. Системная локаль устройства.
 * 3. Дефолтная локаль приложения.
 */
function resolveLocale(): Locale {
  const languageTag = getLocales()[0]?.languageTag ?? '';
  const base = languageTag.split('-')[0];

  if ((locales as readonly string[]).includes(base)) {
    return base as Locale;
  }

  return defaultLocale;
}

type LocaleState = {
  locale: Locale;
  /** Для будущего переключателя языка в настройках */
  setLocale: (locale: Locale) => void;
};

/**
 * Глобальная локаль приложения. Вычисляется один раз при старте
 * (resolveLocale), доступна вне React — например, для форматирования дат.
 */
export const useLocaleStore = create<LocaleState>((set) => ({
  locale: resolveLocale(),
  setLocale: (locale) => set({ locale }),
}));
