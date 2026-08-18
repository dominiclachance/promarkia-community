import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const supportedLngs = ['en', 'fr', 'zh', 'es', 'hi', 'ar', 'pt', 'ja', 'de', 'tr', 'ko'];

const normalizeLng = (lng) => {
  if (!lng || typeof lng !== 'string') return 'en';
  const lower = lng.toLowerCase();
  const base = lower.split('-')[0];
  return supportedLngs.includes(base) ? base : 'en';
};

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs,
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    cleanCode: true,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => normalizeLng(lng),
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

if (i18n.language !== normalizeLng(i18n.language)) {
  i18n.changeLanguage(normalizeLng(i18n.language));
}

export { supportedLngs, normalizeLng };
export default i18n;
