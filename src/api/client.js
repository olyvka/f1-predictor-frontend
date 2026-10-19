import i18n from "../i18n";

// Базова адреса бекенду. Для локальної розробки - .env файл (VITE_API_URL),
// для продакшну - змінна середовища на хостингу (Vercel/Netlify).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Перший запит по (year, round, session), якого ще нема в кеші бекенду, може
// тягнутись дуже довго (FastF1 ходить у зовнішнє джерело, а для поточного/
// ще не завершеного сезону — тим паче). Тримаємо щедрий таймаут; UI (Loader)
// показує, що запит живий, і дає кнопку "Спробувати ще раз", якщо навіть
// цього не вистачило.
const REQUEST_TIMEOUT_MS = 120_000;
// /api/analysis тренує модель на перший запит по етапу — це довше, ніж
// звичайний FastF1-запит, тож тримаємо ще щедріший запас.
const ANALYSIS_TIMEOUT_MS = 240_000;

// Кеш на фронті — доповнює дисковий кеш бекенду. Історичні дані F1 (кола,
// результати, погода тощо) не змінюються, тож раз завантажений шлях більше
// не викликає мережевий запит до перезавантаження сторінки. `inFlight`
// додатково дедуплікує паралельні запити на той самий шлях (напр. коли
// кілька компонентів одночасно просять /api/drivers для тієї ж сесії).
const cache = new Map();
const inFlight = new Map();

// Логуємо кожен запит у консоль браузера (DevTools → Console), щоб було
// видно, який саме шлях і скільки реально виконувався — а не гадати. Старт
// логується одразу, завершення — з часом у мс і результатом.
function logStart(path) {
  console.log(`%c→ ${path}`, "color:#8a929c", "запит відправлено…");
}
function logDone(path, ms, outcome) {
  const color = outcome === "ok" ? "#43b04a" : outcome === "timeout" ? "#ff5c5c" : "#e10600";
  const mark = outcome === "ok" ? "✓" : outcome === "timeout" ? "⏱" : "✗";
  console.log(`%c${mark} ${path} — ${ms}мс (${outcome})`, `color:${color}`);
}

async function fetchJson(path, timeoutMs) {
  const startedAt = performance.now();
  logStart(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    // Мова інтерфейсу — бекенд повертає тексти (помилки, примітки й підписи
    // прогнозу) тією ж мовою.
    res = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      headers: { "Accept-Language": i18n.language },
    });
  } catch (e) {
    const ms = Math.round(performance.now() - startedAt);
    if (e.name === "AbortError") {
      logDone(path, ms, "timeout");
      throw new Error(
        i18n.t("errors.timeout", { minutes: Math.round(timeoutMs / 60000) })
      );
    }
    logDone(path, ms, "network-error");
    throw new Error(i18n.t("errors.network"));
  } finally {
    clearTimeout(timer);
  }
  const ms = Math.round(performance.now() - startedAt);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    logDone(path, ms, `http-${res.status}`);
    throw new Error(body.detail || i18n.t("errors.http", { status: res.status }));
  }
  logDone(path, ms, "ok");
  return res.json();
}

// Відповіді, що містять тексти, кешуємо окремо для кожної мови; решта
// (кола, результати, статистика) від мови не залежить — кеш спільний.
const LANGUAGE_DEPENDENT = ["/api/analysis/"];

function cacheKey(path) {
  return LANGUAGE_DEPENDENT.some((prefix) => path.startsWith(prefix)) ? `${i18n.language}|${path}` : path;
}

async function request(path, timeoutMs = REQUEST_TIMEOUT_MS) {
  const key = cacheKey(path);
  if (cache.has(key)) {
    console.log(`%c• ${path} — з кешу браузера, без мережі`, "color:#f5c518");
    return cache.get(key);
  }
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = fetchJson(path, timeoutMs)
    .then((data) => {
      cache.set(key, data); // кешуємо лише успіх — помилку/таймаут завжди можна повторити
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

function withDrivers(path, drivers) {
  if (!drivers || !drivers.length) return path;
  return `${path}?drivers=${drivers.map(encodeURIComponent).join(",")}`;
}

export const api = {
  // CSV-датасет у пам'яті бекенду — на відміну від FastF1-ендпоінтів
  // нижче, завжди відповідає миттєво, без зовнішньої мережі.
  getSeasons: () => request(`/api/seasons`),
  getCsvResults: (year, round, session) => request(`/api/csv/results/${year}/${round}/${session}`),
  getCsvDrivers: (year, round, session) => request(`/api/csv/drivers/${year}/${round}/${session}`),
  getPitStops: (year, round) => request(`/api/csv/pitstops/${year}/${round}`),

  getRaces: (year) => request(`/api/races/${year}`),
  getSessions: (year, round) => request(`/api/sessions/${year}/${round}`),

  getResults: (year, round) => request(`/api/results/${year}/${round}`),
  getResultsForSession: (year, round, session) =>
    request(`/api/results/${year}/${round}/${session}`),

  getDrivers: (year, round, session) => request(`/api/drivers/${year}/${round}/${session}`),
  getDriver: (year, round, session, driver) =>
    request(`/api/driver/${year}/${round}/${session}/${driver}`),

  getLaps: (year, round, session, drivers) =>
    request(withDrivers(`/api/laps/${year}/${round}/${session}`, drivers)),

  getCompare: (year, round, session, drivers) =>
    request(withDrivers(`/api/compare/${year}/${round}/${session}`, drivers)),

  getWeather: (year, round, session) => request(`/api/weather/${year}/${round}/${session}`),

  // Блоки сторінки "Огляд" етапу — усе з CSV-датасету бекенду, миттєво й
  // без FastF1. event-summary для гонки, що ще не відбулась, повертає null.
  getEventSummary: (year, round) => request(`/api/event-summary/${year}/${round}`),
  getEventStandings: (year, round) => request(`/api/event-standings/${year}/${round}`),
  getCircuitHistory: (year, round) => request(`/api/circuit-history/${year}/${round}`),
  getCircuitFacts: (year, round) => request(`/api/circuit-facts/${year}/${round}`),

  // Чемпіонат і пілоти поза одним етапом — теж CSV, миттєво. driverRef —
  // ідентифікатор з датасету ("max_verstappen"), той самий, що DriverId у FastF1.
  getSeasonProgress: (year) => request(`/api/season-progress/${year}`),
  getDriverSeason: (year, driverRef) => request(`/api/driver-season/${year}/${driverRef}`),
  getDriverCareer: (driverRef) => request(`/api/driver-career/${driverRef}`),
  getDriverEvent: (year, round, driverRef) => request(`/api/driver-event/${year}/${round}/${driverRef}`),

  // Лише читає кеш прогнозу на бекенді, нічого не тренує. Повз кеш
  // браузера: статус змінюється, щойно прогноз порахують на сторінці
  // "Прогноз", і повернення в "Огляд" має це побачити.
  getAnalysisStatus: (year, round) => fetchJson(`/api/analysis/${year}/${round}/status`, REQUEST_TIMEOUT_MS),

  // Прогноз моделі (v2.0). Перший запит по етапу тренує модель — довше за
  // звичайний FastF1-запит, тож окремий, ще щедріший таймаут. `refresh: true`
  // просить бекенд перебудувати прогноз (?refresh=true) і йде повз кеш
  // браузера — інакше друге натискання "Оновити" віддавало б результат
  // першого без мережі. Свіжий результат кладемо в кеш базового шляху, щоб
  // звичайна навігація на цей етап не показала дані з-до оновлення.
  getAnalysis: (year, round, refresh = false) => {
    const basePath = `/api/analysis/${year}/${round}`;
    if (!refresh) return request(basePath, ANALYSIS_TIMEOUT_MS);
    return fetchJson(`${basePath}?refresh=true`, ANALYSIS_TIMEOUT_MS).then((data) => {
      cache.set(cacheKey(basePath), data);
      return data;
    });
  },
};
