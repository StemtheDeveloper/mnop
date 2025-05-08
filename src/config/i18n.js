import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

i18n
  // Load translations using xhr backend
  .use(Backend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    fallbackLng: "en", // Default language
    supportedLngs: ["en", "es", "fr", "de", "zh"], // Supported languages
    debug: import.meta.env.DEV, // Debug only in development

    interpolation: {
      escapeValue: false, // React already safes from XSS
    },

    backend: {
      // Path to load translation files
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    // Default namespace used for translations
    defaultNS: "common",
    ns: ["common", "products", "checkout", "profile", "admin"],

    // React settings
    react: {
      useSuspense: true,
    },
  });

export default i18n;
