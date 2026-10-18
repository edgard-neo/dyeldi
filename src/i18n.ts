import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import sidebar from './locales/pt/sidebar.json';
import header from './locales/pt/header.json';
import auth from './locales/pt/auth.json';
import demo from './locales/pt/demo.json';
import titles from './locales/pt/titles.json';
import common from './locales/pt/common.json';
import overview from './locales/pt/overview.json';
import settings from './locales/pt/settings.json';
import profile from './locales/pt/profile.json';
import footer from './locales/pt/footer.json';
import summary from './locales/pt/summary.json';
import modals from './locales/pt/modals.json';

const ptTranslation = {
  app: {
    name: 'Dyeldi',
    tagline: 'Gestão de Ações, FIIs e Dividendos',
    loading: 'Carregando plataforma...',
  },
  nav: sidebar,
  header,
  auth,
  demo,
  titles,
  common,
  overview,
  settings_view: settings,
  profile_view: profile,
  footer,
  summary,
  modals,
};

const resources = {
  pt: {
    translation: ptTranslation,
  },
  'pt-BR': {
    translation: ptTranslation,
  },
  en: {
    translation: ptTranslation,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

