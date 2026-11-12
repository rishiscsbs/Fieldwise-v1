import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANG, NAMESPACES, resources } from '@fieldwise/shared';
import { useUi } from '../stores/ui';

void i18n.use(initReactI18next).init({
  resources,
  lng: useUi.getState().lang,
  fallbackLng: DEFAULT_LANG,
  ns: [...NAMESPACES],
  defaultNS: 'app',
  // React escapes output already.
  interpolation: { escapeValue: false },
  returnNull: false,
});

useUi.subscribe((s, prev) => {
  if (s.lang !== prev.lang) {
    void i18n.changeLanguage(s.lang);
    document.documentElement.lang = s.lang;
  }
});

export default i18n;
