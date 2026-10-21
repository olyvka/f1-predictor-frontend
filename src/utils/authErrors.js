import i18n from "../i18n";

// Повідомлення про помилку Firebase Auth мовою інтерфейсу (ключі auth.errors.*).
export function authErrorMessage(error) {
  const code = String(error?.code || "").replace("auth/", "");
  return i18n.t(`auth.errors.${code}`, { defaultValue: i18n.t("auth.errors.default") });
}
