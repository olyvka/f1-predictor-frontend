// «Прогноз vs реальність наживо» (L12, W13): зіставлення пілотів прогнозу з
// пілотами потоку і кореляція Спірмена.
//
// У прогнозі (/api/analysis) немає driver_number, лише driver_id та ім'я:
//   1) predictions[].driver_id → /api/event-standings drivers[].driver_id → code
//      ("ANT") = drivers[].name_acronym у потоці;
//   2) запасний шлях (дебютант без standings): нормалізоване повне ім'я
//      («Lewis Hamilton» ≡ «Lewis HAMILTON»), далі - унікальне прізвище;
//   3) незіставлені → у списку unmatched (віджет показує «—» і логує).

/** Нижній регістр, без діакритики й зайвих пробілів. */
export function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const surname = (name) => normalizeName(name).split(" ").at(-1) || "";

/**
 * predictions - /api/analysis predictions[]; standings - /api/event-standings
 * drivers[] (може бути порожнім/null); drivers - пілоти потоку (session.drivers).
 * Повертає {byNumber: {[driver_number]: prediction}, unmatched: prediction[]}.
 */
export function matchPredictions(predictions, standings, drivers) {
  const byNumber = {};
  const unmatched = [];
  const byAcronym = new Map();
  const byFullName = new Map();
  const bySurname = new Map();
  for (const d of drivers || []) {
    if (d.name_acronym) byAcronym.set(String(d.name_acronym).toUpperCase(), d.driver_number);
    byFullName.set(normalizeName(d.full_name), d.driver_number);
    const sn = surname(d.full_name);
    bySurname.set(sn, bySurname.has(sn) ? null : d.driver_number); // null - неоднозначно
  }
  const codeById = new Map();
  for (const s of standings || []) if (s.driver_id != null && s.code) codeById.set(s.driver_id, String(s.code).toUpperCase());

  for (const p of predictions || []) {
    let n = null;
    const code = codeById.get(p.driver_id);
    if (code && byAcronym.has(code)) n = byAcronym.get(code);
    if (n == null) n = byFullName.get(normalizeName(p.driver)) ?? null;
    if (n == null) n = bySurname.get(surname(p.driver)) ?? null;
    if (n == null || byNumber[n]) unmatched.push(p);
    else byNumber[n] = p;
  }
  return { byNumber, unmatched };
}

/** Середні ранги з урахуванням однакових значень (1-based). */
export function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

/** Кореляція Спірмена двох рівних за довжиною масивів чисел. null, якщо n < 2 або нульова дисперсія. */
export function spearman(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 2) return null;
  const ra = ranks(a);
  const rb = ranks(b);
  const n = ra.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mb = rb.reduce((s, v) => s + v, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : null;
}

/**
 * Плитка «Модель зараз»: pairs - [{position, predicted}] для зіставлених пілотів
 * з поточною позицією. Повертає {rho, podium (збігів у топ-3), exact, n}.
 */
export function modelVsRace(pairs) {
  const valid = (pairs || []).filter((p) => Number.isFinite(p.position) && Number.isFinite(p.predicted));
  const n = valid.length;
  if (!n) return { rho: null, podium: 0, exact: 0, n: 0 };
  const rho = n > 3 ? spearman(valid.map((p) => p.predicted), valid.map((p) => p.position)) : null;
  const top = (key) => new Set([...valid].sort((x, y) => x[key] - y[key]).slice(0, 3));
  const actualTop = top("position");
  const podium = [...top("predicted")].filter((p) => actualTop.has(p)).length;
  const exact = valid.filter((p) => p.predicted === p.position).length;
  return { rho, podium, exact, n };
}
