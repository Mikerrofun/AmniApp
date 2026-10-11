import { useContext } from 'react';

import { defaultLocale } from './i18n.config';
import { I18nContext } from './I18nProvider';
import { createTranslator, type Translator } from './translate';

/** Хук перевода: t('chats.newChat'), t('popover.deleteConfirm', { title }) */
export function useT(): Translator {
  const context = useContext(I18nContext);

  return context ? context.t : createTranslator(defaultLocale);
}
