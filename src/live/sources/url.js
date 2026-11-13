// Побудова адрес WebSocket з VITE_API_URL (http→ws, https→wss).

/** "http://localhost:8000/" → "ws://localhost:8000"; "https://api.x" → "wss://api.x". */
export function toWsBase(apiUrl) {
  const base = String(apiUrl || "http://localhost:8000").trim().replace(/\/+$/, "");
  if (/^wss?:\/\//i.test(base)) return base;
  if (/^https:\/\//i.test(base)) return base.replace(/^https:\/\//i, "wss://");
  if (/^http:\/\//i.test(base)) return base.replace(/^http:\/\//i, "ws://");
  return `ws://${base}`;
}

/** Секунди offset для URL: до 0.1 с, без «-0». */
export function roundOffset(offset) {
  const v = Math.round((Number(offset) || 0) * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
}

/** WS /ws/replay/{year}/{round}/{session}?speed=&offset=&lang= */
export function buildReplayUrl({ apiUrl, year, round, session, speed = 1, offset = 0, lang = "uk" }) {
  const q = new URLSearchParams({ speed: String(speed), offset: String(roundOffset(offset)), lang: String(lang || "uk") });
  return `${toWsBase(apiUrl)}/ws/replay/${encodeURIComponent(year)}/${encodeURIComponent(round)}/${encodeURIComponent(session)}?${q}`;
}

/** WS /ws/live?lang= - майбутнє live-джерело (L13), протокол той самий. */
export function buildLiveUrl({ apiUrl, lang = "uk" }) {
  return `${toWsBase(apiUrl)}/ws/live?${new URLSearchParams({ lang: String(lang || "uk") })}`;
}
