import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./uk";
import en from "./en";

export const LANGUAGES = ["uk", "en"];
const STORAGE_KEY = "lang";

// Параметр ?lang= в адресі, інакше збережений вибір, інакше мова браузера:
// українська для "uk-*", англійська для решти. localStorage може бути недоступний (приватний режим) — тоді
// просто визначаємо заново.
function detectLanguage() {
  // ?lang=en / ?lang=uk в адресі — щоб поділитися посиланням потрібною мовою.
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (LANGUAGES.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    /* немає доступу до сховища */
  }
  return (navigator.language || "").toLowerCase().startsWith("uk") ? "uk" : "en";
}

i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: "uk",
  interpolation: { escapeValue: false }, // React сам екранує
});

function syncDocument(lng) {
  document.documentElement.lang = lng;
  document.title = i18n.t("app.title");
}
syncDocument(i18n.language);
i18n.on("languageChanged", (lng) => {
  syncDocument(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* немає доступу до сховища */
  }
});

/** Локаль для Intl (дати, числа). en-GB — 24-годинний час і "23–25 Oct". */
export function intlLocale() {
  return i18n.language === "en" ? "en-GB" : "uk-UA";
}

export default i18n;

/** Переклад поза React-хуками (підказки графіків, допоміжні функції). При
 *  зміні мови вміст сторінки перемонтовується (App.jsx), тож рядки оновлюються. */
export function t(...args) {
  return i18n.t(...args);
}
