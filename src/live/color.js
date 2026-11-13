// Кольори команд (LIVE_UI_RESEARCH §5.5): колір лише ідентифікує пілота,
// тож темні team_colour підтягуємо до контрасту ≥ 3:1 з фоном панелей.

/** Фон, з яким перевіряємо контраст (--color-surface з src/index.css). */
export const DEFAULT_SURFACE = "#111318";
/** team_colour == null → нейтральний сірий. */
export const FALLBACK_TEAM_COLOR = "#6B7280";

const pad2 = (v) => v.toString(16).padStart(2, "0");

/** "F47600" / "#f47600" → "#F47600"; некоректне/порожнє → null. */
export function normalizeHex(raw) {
  if (raw == null) return null;
  const h = String(raw).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) return `#${[...h].map((c) => c + c).join("")}`.toUpperCase();
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toUpperCase()}` : null;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function rgbToHex(c) {
  return `#${c.map((v) => pad2(Math.round(Math.max(0, Math.min(1, v)) * 255))).join("")}`.toUpperCase();
}

/** Відносна яскравість WCAG. */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двох hex-кольорів за WCAG (1..21). */
export function contrastRatio(a, b) {
  const x = luminance(hexToRgb(a));
  const y = luminance(hexToRgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Колір команди з контрастом ≥ min до фону: на темному фоні освітлюємо
 * кроками 12% до білого, на світлому - темнимо (до 12 кроків).
 * Повертає "#RRGGBB"; null/некоректний → FALLBACK_TEAM_COLOR.
 */
export function fixContrast(teamColour, background = DEFAULT_SURFACE, min = 3) {
  const hex = normalizeHex(teamColour) || FALLBACK_TEAM_COLOR;
  const bg = normalizeHex(background);
  if (!bg) return hex;
  const darkBg = luminance(hexToRgb(bg)) < 0.5;
  let c = hexToRgb(hex);
  for (let i = 0; i < 12 && contrastRatio(rgbToHex(c), bg) < min; i++) {
    c = c.map((v) => (darkBg ? v + (1 - v) * 0.12 : v * 0.88));
  }
  return rgbToHex(c);
}

/** Текст на плашці кольору команди: чорний або білий - що контрастніше. */
export function textOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#FFFFFF";
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#FFFFFF") ? "#000000" : "#FFFFFF";
}
