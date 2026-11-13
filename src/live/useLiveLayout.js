import { useSyncExternalStore } from "react";

// Брейкпоінти екрана Live (LIVE_UI_RESEARCH §3), збігаються з Tailwind md / xl.
export const LIVE_BREAKPOINTS = { tablet: 768, desktop: 1280, wide: 1680 };

const QUERIES = {
  desktop: `(min-width: ${LIVE_BREAKPOINTS.desktop}px)`,
  tablet: `(min-width: ${LIVE_BREAKPOINTS.tablet}px)`,
  wide: `(min-width: ${LIVE_BREAKPOINTS.wide}px)`,
};

function read() {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(QUERIES.wide).matches) return "wide";
  if (window.matchMedia(QUERIES.desktop).matches) return "desktop";
  if (window.matchMedia(QUERIES.tablet).matches) return "tablet";
  return "mobile";
}

function subscribe(cb) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", cb));
  return () => lists.forEach((l) => l.removeEventListener("change", cb));
}

/**
 * Поточний layout екрана: "mobile" (< 768) | "tablet" (768-1279) |
 * "desktop" (1280-1679) | "wide" (≥ 1680). Сторінка передає його віджетам
 * пропом `layout`, щоб віджет змонтувався один раз і лише змінював вигляд.
 */
export function useLiveLayout() {
  return useSyncExternalStore(subscribe, read, () => "desktop");
}
