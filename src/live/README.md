# Екран Live / Replay: контракт фундаменту

Цей документ - контракт між фундаментом (`src/live/`, сторінка `LivePage`) і
віджетами (`src/components/live/`). Віджети пишуться паралельно різними агентами
й **не** змінюють спільні файли (див. «Власники файлів»). Протокол даних -
`f1-predictor-backend/README.md`, «Replay сесії через WebSocket»; завдання -
`FRONTEND_LIVE_TASKS.md` (L1-L14); дизайн - `LIVE_UI_RESEARCH.md`.

## 1. Архітектура

```
 WS /ws/replay/{y}/{r}/{s}?speed&offset&lang        ?source=fixture
            │                                             │
   ReplaySource (sources/ReplaySource.js)      FixtureSource = ReplaySource
   - статуси, connId, seek, backoff              + FixtureSocket (фейковий WS,
   - pause/resume/setSpeed (оптимістично)          програє __fixtures__/*.json)
            │  store.receive(msg) / store.setConnection({status…})
            ▼
   createLiveStore() (store.js)
   ├─ реактивний стан (copy-on-write) ──► канали: meta | playback | table |
   │    session, drivers, position,           focus | rc | weather | telemetry
   │    intervals, laps, stints, pits,        (сповіщення ≤ 1 раз на batch, ~4/с)
   │    raceControl, weather, carData,               │
   │    best, trackStatus, derived                   ▼
   │                                       hooks.js (useSyncExternalStore)
   │                                       useTower, useReplay, useFocus, …
   │                                                 │
   └─ мутабельні буфери (поза React) ──► store.getCarsAt(renderTime) у rAF
        TimeRing location ~26 с/пілот,      store.getSpeedTrace(n), getTrail(n)
        car_data поточного + попер. кола            │
                                                    ▼
   LivePage (pages/LivePage.jsx): <LiveProvider> + сітка зі слотами
   StatusBar · WeatherChips · TrackStatusBanner · TimingTower · TrackMap ·
   FocusPanel · RaceControlPanel · ReplayControls · ConnectionOverlay
```

Майбутній `LiveSource` (`sources/LiveSource.js`, `WS /ws/live`, `mode: "live"`)
має той самий інтерфейс; у нього `capabilities = {pause:false, speed:false, seek:false}`.
Стор і віджети від джерела не залежать: віджети дивляться лише на
`useReplay().mode` і `useReplay().capabilities`.

## 2. Як запустити

| Що | Команда / адреса |
|---|---|
| Бекенд | `cd f1-predictor-backend && .venv/bin/uvicorn app.main:app --port 8000` |
| Фронт | `npm run dev` |
| Гонка з бекенду | `http://localhost:5173/live/2026/20/R?speed=5&offset=1320` |
| **Без бекенду (фікстура)** | `http://localhost:5173/live/2026/20/R?source=fixture&speed=5` |
| Кваліфікація без бекенду | `http://localhost:5173/live/2026/20/Q?source=fixture` (без `intervals`) |
| Імітація обриву | `…?source=fixture&drop=5` (через 5 с з'єднання «падає» → `lost` → перепідключення) |
| Інша фікстура | `…?source=fixture&fixture=brazil-2026-quali` |
| Тести | `npm test` (Vitest, `src/live/__tests__/`) |
| Лінт / збірка | `npm run lint`, `npm run build` |
| Новий запис фікстури | `npm run record:fixture -- --path /ws/replay/2026/20/R --offset 1320 --speed 5 --seconds 30 --out src/live/__fixtures__/x.json` |

- Фікстури (по ~3.3 МБ, ~2.5 хв часу сесії кожна):
  - `brazil-2026-race.json` - гонка з 22-ї хвилини (`offset=1320`, ×5): мокра
    траса, проміжні шини, 35 завершених кіл, жовті/подвійні жовті сектори в
    catch-up; SC, синіх прапорів і піт-стопів у цьому вікні **немає** (для них
    тести використовують синтетичні події);
  - `brazil-2026-quali.json` - кінець Q1 (`offset=5980`): фінальні спроби,
    CHEQUERED, червоний прапор і TRACK CLEAR у catch-up, 44 події `pit`,
    машини в боксах, без `intervals`.
  Перемотування працює лише в межах запису.
- Офлайн-режим доступний у `npm run dev` (у production-бандл фікстури не
  потрапляють; увімкнути там можна збіркою з `VITE_LIVE_FIXTURES=1`).
- У dev у консолі є `window.__live = {store, source}`:
  `__live.source.seek(1500)`, `__live.store.getState()`, `__live.store.getTower()`.
- Маршрут: `/live/:year/:round/:session`, query `speed` (0.25-20), `offset`
  (секунди від запланованого старту), `source=fixture`. Адреса сама оновлює
  `offset`/`speed` під час перегляду, тож посилання відкриває той самий момент.
  Сезони < 2023 показують пояснення замість екрана. Вхід - кнопка
  «Дивитись replay» на сторінці завершеної сесії.

## 3. Стан стору (`store.getState()`)

Усі моменти часу - **мс epoch UTC** (`t`, `clock`, `sessionStart`…). Кожен
збережений запис OpenF1 зберігає всі свої поля + `t` (для `laps` - момент
завершення кола `date_start + lap_duration`, для `stints` - clock батча).
`null` - нормальне значення будь-якого поля OpenF1.

```js
{
  mode: "replay" | "live" | null,
  session: {session_key, session_name, session_type, date_start, date_end,
            circuit_short_name, country_name, location, year} | null,
  sessionStart: ms | null,
  replay: {start, end, speed, startMs, endMs} | null,       // null у live
  drivers: { [n]: Driver },        // див. нижче
  driverNumbers: number[],         // за номером
  track: { points: [[x,y]…], geometry } | null,              // geometry - geometry.js
  position:  { [n]: {position, t} },
  intervals: { [n]: {gap_to_leader, interval, t} },          // число | null | "+1 LAP"
  laps:   { [n]: Lap[] },          // за lap_number, upsert (n, lap_number)
  stints: { [n]: Stint[] },        // за stint_number, upsert (n, stint_number)
  pits:   { [n]: Pit[] },          // за часом, без дублікатів (date + lap_number)
  raceControl: Msg[],              // НОВІШІ ПЕРШИМИ, ≤ 200
  weather: {...weather, t} | null,
  carData: { [n]: {...car_data, t} },                        // остання на пілота
  best: { lap: {time, driverNumber, lapNumber} | null,
          sectors: [{time, driverNumber} | null ×3] },
  personalBest: { [n]: {lap, lapNumber, sectors: [s1,s2,s3]} },
  trackStatus: TrackStatus,        // trackStatus.js
  derived: { inPit: {[n]: bool}, gone: {[n]: bool}, stale: {[n]: bool},
             blueFlag: {[n]: bool}, warning: {[n]: Msg} },
  watchStart: ms | null,           // replay.start (з якого моменту є location)
  lastEventAt: ms | null,          // date останньої події (для «немає даних N с»)
  playback: {
    mode, status, error, reconnect: {attempt, delayMs, retryAt} | null,
    connId, speed, paused, clock, clockRecvAt, epoch,
    seeking: {offset, target} | null, ended, lastBatchAt
  },
  focus: n | null, rival: n | null,
}
```

`Driver = {...поля OpenF1 drivers, number, acronym, rawColor ("#RRGGBB"),
color (контраст ≥ 3:1 до --color-surface), teammate (номер) | null,
isSecondTeammate (більший номер у команді: на карті біла крапка, на графіках пунктир)}`.

Похідні (`derived`, рахуються раз на batch на момент `clock`):
- `inPit` - останній `location` далі за `PIT_LANE_DISTANCE = 150` від контуру
  (подію `pit` для цього не використовуємо: її `date` ≈ виїзд із боксів);
- `gone` - немає `location` > 30 с (від `watchStart`, якщо не було жодного) →
  у гонці «СХІД/OUT», у кваліфікації/практиці «ГАРАЖ»;
- `stale` - немає `location` > 10 с (приглушити на карті);
- `blueFlag` - `race_control.flag == "BLUE"` для пілота за останні 10 с;
- `warning` - повідомлення з `TRACK LIMITS|PENALTY|INVESTIGATION|DELETED|NOTED|BLACK AND WHITE`
  за 60 с (пілот з `driver_number` або з тексту «CAR 12 (ANT)»).

Статуси `playback.status`: `idle → connecting → loading (сокет відкрито,
session ще немає) → playing | paused | buffering (clock не росте > 2 с) →
ended | error | lost`. У `lost` - автопідключення 1/2/4/8/15 с з `offset =
останній clock − sessionStart`; після `error` - лише `retry()`.

## 4. Канали і частота оновлень

| Канал | Коли сповіщається | Частота |
|---|---|---|
| `meta` | нова `session` (старт, перемотування, перепідключення) | рідко |
| `playback` | кожен batch (clock), state, дії, статус з'єднання | ~4/с |
| `table` | position, intervals, laps, stints, pit; зміна `derived` | ≤ 4/с |
| `focus` | setFocus / setRival | на дію |
| `rc` | нове повідомлення race control | рідко |
| `weather` | нова погода | ~1/хв |
| `telemetry` | у батчі була car_data (будь-якого пілота) | ~4/с |

`location`/`car_data` (~160 подій/с) **ніколи** не сповіщають React окремо:
вони пишуться в мутабельні буфери. Сповіщення тротлиться (`throttleMs = 200`)
і йде одним викликом на batch. Catch-up, нова session і дії користувача
сповіщають одразу.

## 5. Хуки (`src/live/hooks.js`)

Усі хуки працюють лише всередині `<LiveProvider>` (його ставить `LivePage`).
Повернені об'єкти стабільні, поки їхній канал не змінився.

| Хук | Канали | Повертає |
|---|---|---|
| `useSession()` | meta | `{mode, session, sessionStart, replay, drivers, driverList, track, isRace, ready}` |
| `useDriver(n)` | meta | `Driver \| null` |
| `useReplay()` | playback, meta | `{mode, status, error, reconnect, paused, speed, clock, sessionStart, replayStart, replayEnd, seeking, ended, epoch, lastEventAt, lastBatchAt, capabilities, pause(), resume(), togglePause(), setSpeed(n), seek(offsetSec), seekToTime(ms), retry()}` |
| `useClockLocal(ms=250)` | playback + таймер | плавний годинник сесії (мс epoch) для тексту; стоїть на паузі |
| `useTower()` | table, meta | `{rows: TowerRow[], isRace, hasIntervals, leaderNumber, leaderLap, bestLap, bestSectors, epoch, instant}` |
| `useDriverDetail(n)` | table, meta | `{driver, position, intervals, laps, lastLap, stints, stint, tyreAge, pits, personalBest, sessionBest, inPit, gone} \| null` |
| `useFocus()` | focus | `{focus, rival, setFocus(n\|null), toggleFocus(n), setRival(n\|null), clear()}` |
| `useFocusDriver()` | focus, table | `{number, isFallback}` - вибраний або лідер |
| `useCarData(n)` | telemetry | остання `car_data` + `t` або `null` |
| `useSpeedTrace(n)` | telemetry, meta | `{lapNumber, lapStart, partial, current: [{f,t,speed,throttle,brake}], previous: [...], previousLapNumber} \| null` |
| `useRaceControl()` | rc | `{messages (новіші першими), trackStatus}` |
| `useTrackStatus()` | rc | `{status: TrackStatus, banner: {kind, phase, message, sectors} \| null}` |
| `useWeather()` | weather | погода або `null` |
| `useCircuitFacts()` | REST | `{data, loading, error, refetch, typicalLaps}` (`/api/circuit-facts`) |
| `useLapCounter()` | table + REST | `{current (коло лідера ≤ total), total (typical_laps лише для гонки/спринту, інакше null), isRace}` |
| `usePredictions({enabled})` | REST + meta | `{status: idle\|loading\|ready\|error, error, byNumber: {[n]: prediction}, unmatched, analysis}` |
| `useLiveSelector(channels, sel, isEqual)` | будь-які | власний селектор `sel(state, store)` |
| `useLiveStore()` / `useLiveSource()` / `useLiveParams()` | - | стор, джерело, `{year, round, session, sourceKind}` |
| `useLiveLayout()` (`useLiveLayout.js`) | matchMedia | `"mobile" \| "tablet" \| "desktop" \| "wide"` |

`TowerRow`:
```js
{ driverNumber, driver, position, isLeader,
  gapToLeader, interval, intervalsAt,      // сирі значення: число | null | "+1 LAP"
  lapsCompleted, currentLap, lastLap, lastLapTime, lastLapIsPit,
  lastLapIsSessionBest, lastLapIsPersonalBest, bestLapTime, hasSessionBest,
  gapToBest,                               // для кваліфікації/практики, с
  stint, compound, tyreAge, usedSet, pits, pitCount, lastPit,
  inPit, gone, stale, blueFlag, warning }
```
Рядки впорядковані за `position` (без позиції - у кінці, далі за
`gap_to_leader`, далі за номером). Переміщувати зійшлих униз - справа таблиці.

### Анімації: `epoch` та `instant`

`playback.epoch` збільшується при новій `session` (старт, перемотування,
перепідключення) і при застосуванні catch-up. `useTower().instant === true`,
поки таблиця показує стан із catch-up (до першої звичайної зміни). Правило для
віджетів: **якщо `instant` або `epoch` змінився з минулого рендера - жодних
переходів/підсвіток** (стан застосовується миттєво, §5.8). Під час
`playback.seeking != null` сітка приглушена сторінкою, старий кадр лишається.

## 6. Імперативні аксесори (Canvas, rAF)

```js
const store = useLiveStore();
// у requestAnimationFrame:
const rt = store.getRenderTime();      // clockLocal − max(0.6 с, 0.4 × speed) у часі сесії; null до session
const cars = store.getCarsAt(rt);      // МАСИВ І ОБ'ЄКТИ ПЕРЕВИКОРИСТОВУЮТЬСЯ - не зберігати
// cars[i] = {driverNumber, ok, x, y, age (с), gap (пропуск > 2 с, без lerp),
//            stale (> 10 с), gone (> 30 с), inPit (> 150 від контуру),
//            trackDistance, lapFraction (0..1), snapX, snapY (точка на контурі)}
store.getClockLocal();                 // плавний годинник (мс), монотонний у межах epoch
store.getTrack();                      // {points, geometry} | null
store.getSeenPoints();                 // [[x,y]…] розріджені location (bbox з піт-лейном)
store.getTrail(n);                     // TimeRing: forEachSince(fromMs, (t,x,y) => …)
store.getSpeedTrace(n);                // те саме, що useSpeedTrace, кешовано на версію
store.getTelemetryLap(n);              // сирі car_data поточного/попереднього кола (лише читати)
store.getLastLocationAt(n);            // мс | null
store.getTower();                      // те саме, що useTower
```
Карта: `fitRotation(points, W, H, {padding})` + `toScreen(fit, x, y, out)` з
`geometry.js` (автоповорот 0-175° кроком 5°, вісь Y інвертована; dpr - у віджеті).
Пауза/буферизація: `getClockLocal()` заморожений, тож машини стоять самі.

## 7. Чисті утиліти

| Модуль | Що |
|---|---|
| `format.js` | `formatLapTime` (1:12.456), `formatSectorTime`, `formatGap(v, {t, digits})` (+1.234, ≥60 с +1:02.3, «+1 LAP» → `t("live.common.lapsDown")`, null → «—»), `parseGap`, `formatDelta`, `gapBetween`, `formatClock`, `formatInt`, `DASH` |
| `tyres.js` | `COMPOUNDS`, `compoundMeta(c)` → `{letter, color (CSS var), key}`, `tyreAge(stint, lastLap)`, `isUsedSet`, `currentStint` |
| `trackStatus.js` | `reduceTrackStatus`, `deriveTrackStatus`, `bannerFor`, `rcFilterKind(msg)` → flag/sc/penalty/other, `PENALTY_RE` |
| `geometry.js` | `buildTrackGeometry`, `projectOnTrack(g, x, y, {hint, out})` → `{distance, s, fraction, index, x, y}`, `isInPitLane`, `fitRotation`, `toScreen`, `unwrapLapFraction`, `PIT_LANE_DISTANCE` |
| `color.js` | `fixContrast(hex, bg, 3)`, `contrastRatio`, `textOn(hex)`, `normalizeHex` |
| `predictions.js` | `matchPredictions(predictions, standingsDrivers, streamDrivers)` (driver_id → code → name_acronym, далі ім'я без діакритики, далі унікальне прізвище), `spearman`, `ranks`, `modelVsRace(pairs)` → `{rho, podium, exact, n}` |
| `ringBuffer.js` | `TimeRing` (typed arrays: `push`, `sample(t, out)`, `forEachSince`) |
| `availability.js` | `isReplayYear`, `isSessionFinished`, `replayPath`, `FIRST_REPLAY_YEAR = 2023` |

## 8. Візуальна система (токени в `src/index.css`, блок «Live / Replay»)

Базові токени застосунку мають пріоритет (`--color-bg`, `--color-surface`,
`--color-surface-2`, `--color-surface-hover`, `--color-line`, `--color-text`,
`--color-text-dim`, `--color-accent`, `--color-good`, `--color-warn`,
`--color-danger`; шрифти Inter / Roboto Condensed (`.uppercase`, заголовки) /
`.font-mono-data`). Тема лише темна. Нові токени live:
`--color-timing-purple`, `--color-timing-purple-bg`, `--color-timing-green`,
`--color-timing-yellow` (лише міні-сектори), `--color-pit-lane`,
`--color-flag-{green,yellow,double-yellow,sc,red,blue,chequered-light,chequered-dark,ink}`,
`--color-tyre-{soft,medium,hard,inter,wet,unknown}`, `--color-row-gain`,
`--color-row-loss`, `--color-elimination-bg`, `--color-track`, `--color-track-edge`.
Клас `.live-cb` на контейнері вмикає палітру Okabe-Ito для дальтоніків; клас
`.tabular` - tabular-nums для чисел.

Правило «колір ніколи не єдиний носій сенсу»: фіолетовий - плашка + ⏱,
зелений - напівжирний, прапори - завжди з текстом, шини - літера S/M/H/I/W/?,
▲/▼ поруч із кольором зміни позиції.

## 9. Чого НЕ малюємо (LIVE_UI_RESEARCH §6)

- **DRS** у будь-якому вигляді (індикатор, зони, «DRS possible»): у 2026 DRS
  скасовано, `car_data.drs` завжди `null`.
- Активна аеродинаміка / overtake-режими 2026, ERS, батарея, паливо, вага.
- Температура/тиск/знос шин, «% життя шини» (є лише вік комплекту).
- Сила гальмування (`brake` лише 0/100 → індикатор вкл/викл), кут керма, G-сили, температура гальм.
- Бортове відео, командне радіо.
- Положення поперек траси, номери поворотів, жовті прапори на ділянках карти
  (геометрії маршальських секторів немає - сектори лише списком у банері/стрічці;
  прапор на всю трасу можна тонувати весь контур).
- Розташування speed trap / I1 / I2 на карті, відстані між машинами в метрах.
- «Список обгонів» (зміна позиції не відрізняє обгін від піт-циклу) - лише «Зміни позицій».
- Живі кольори міні-секторів під час кола (кола приходять після завершення).
- Будь-які значення, яких немає в топіках протоколу. Якщо дуже треба - запит
  на бекенд, а не вигадані дані.

## 10. Власники файлів

| Файли | Власник | Завдання |
|---|---|---|
| `src/components/live/TimingTower.jsx`, `StatusBar.jsx`, `TrackStatusBanner.jsx`, `src/i18n/live/tower.{uk,en}.js` | агент A | L7, W1, W2, L9 (банер), L5 (годинник/коло в статус-барі), L14 (свіжість) |
| `src/components/live/TrackMap.jsx`, `src/i18n/live/map.{uk,en}.js` | агент B | L6, W4 |
| `src/components/live/FocusPanel.jsx`, `src/i18n/live/focus.{uk,en}.js` | агент C | L8, L11, L12, W5, W6, W12, W13 |
| `src/components/live/ReplayControls.jsx`, `RaceControlPanel.jsx`, `WeatherChips.jsx`, `ConnectionOverlay.jsx`, `src/i18n/live/{controls,events}.{uk,en}.js` | агент D | L5, L9 (стрічка), L10, L14, W7, W8, W9, W15 |
| **Спільні (фундамент): усе в `src/live/`, `src/pages/LivePage.jsx`, `src/live/layout.css`, `src/i18n/live/common.*`, `src/i18n/live/index.js`, `src/index.css`, `src/App.jsx`, `src/i18n/index.js`, `src/components/live/WidgetStub.jsx`** | фундамент | L1, L2, L3, L4, L13, база L14 |

Правила для агентів віджетів:
1. Редагуєте лише свої файли. Нові допоміжні компоненти - у
   `src/components/live/<ВашВіджет>/…` або з префіксом свого віджета.
2. Дані - лише через хуки та аксесори вище. Не імпортуйте `api/client` для
   live-даних і не створюйте власних WebSocket.
3. Пропси віджета фіксовані (зараз це `layout`, у TrackMap ще `labelMode`):
   сторінка їх уже передає.
4. Тексти - лише через `t("live.<ваш-розділ>.…")` в обох мовах; спільні
   (статуси, вкладки, шини, «+N коло») - `live.common.*`.
5. Потрібне щось від стору/сторінки (нове поле, канал, слот, токен)? Не
   міняйте спільні файли - додайте пункт у розділ **«Запити до фундаменту»**
   свого звіту.
6. `WidgetStub` - тимчасова рамка заглушок; реалізований віджет її не використовує.
