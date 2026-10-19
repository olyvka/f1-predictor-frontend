// Контури трас — статичні файли public/circuits/<year>.json, згенеровані
// скриптом бекенду scripts/build_circuits.py (джерело — MultiViewer).
// Не через api/client: це не бекенд, а файли самого фронтенду.
// Формат: { year, rounds: { "<round>": { circuit, layout_year, viewBox,
// path, start: {x, y, angle}, corners: [{n, x, y, lx, ly}] } } }

const cache = new Map(); // year -> Promise<rounds>

// Року без файлу (до 2018-го) просто немає: SPA-rewrite на Vercel віддасть
// index.html замість 404, тож будь-яку помилку розбору трактуємо як "контурів
// немає", а не як збій сторінки — карта траси лише доповнює дані.
export function fetchCircuits(year) {
  if (!cache.has(year)) {
    const promise = fetch(`${import.meta.env.BASE_URL}circuits/${year}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.rounds || {})
      .catch(() => ({}));
    cache.set(year, promise);
  }
  return cache.get(year);
}
