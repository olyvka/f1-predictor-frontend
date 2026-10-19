// Українська — мова за замовчуванням. Множина: _one / _few / _many / _other (правила Intl.PluralRules).
const uk = {
  "app": {
    "title": "F1 Predictor",
    "back": "Назад",
    "language": "Мова інтерфейсу"
  },
  "common": {
    "loadingPage": "Завантажуємо сторінку…",
    "loading": "Завантаження…",
    "noData": "Немає даних",
    "of": "з"
  },
  "countdown": {
    "now": "зараз",
    "days": "через {{count}} дн.",
    "hours": "через {{count}} год",
    "minutes": "через {{count}} хв"
  },
  "units": {
    "kph": "{{value}} км/год",
    "seconds": "{{value}}с",
    "laps_one": "{{count}} коло",
    "laps_few": "{{count}} кола",
    "laps_many": "{{count}} кіл",
    "laps_other": "{{count}} кола",
    "mps": "{{value}} м/с",
    "mpsShort": "м/с",
    "secondsSpaced": "{{value}} с",
    "km": "{{value}} км",
    "d": "дн",
    "h": "год",
    "m": "хв",
    "s": "с"
  },
  "errors": {
    "timeout": "Запит триває надто довго (понад {{minutes}} хв). Спробуй ще раз — повторний запит буде швидшим (дані кешуються на сервері).",
    "network": "Не вдалося звʼязатися з сервером.",
    "http": "Помилка запиту: {{status}}"
  },
  "trackStatus": {
    "1": "Чисто",
    "2": "Жовті прапори",
    "3": "SC (виїзд)",
    "4": "Safety Car",
    "5": "Червоні прапори",
    "6": "VSC",
    "7": "VSC (завершення)",
    "unknown": "Код {{code}}"
  },
  "flags": {
    "yellow": "Жовті прапори",
    "safetyCar": "Safety Car / VSC",
    "red": "Червоні прапори"
  },
  "classified": {
    "R": "Сход",
    "D": "Дискваліфікація",
    "W": "Знятий",
    "E": "Виключений",
    "N": "Не класифіковано"
  },
  "loader": {
    "title": "Завантаження",
    "hint6": "Перший запит по цих даних може тривати довше — далі він буде миттєвим (кешується і на сервері, і в браузері).",
    "hint20": "Це довше за звичне — бекенд ще тягне дані із зовнішнього джерела, чекаємо далі.",
    "hint45": "Це справді довге очікування — бекенд усе ще тягне дані ззовні. Запит перерветься сам через 2 хв, тоді можна буде повторити."
  },
  "error": {
    "title": "Помилка",
    "retry": "Спробувати ще раз"
  },
  "nav": {
    "breadcrumb": "Навігація"
  },
  "circuit": {
    "mapLabel": "Схема траси {{name}}"
  },
  "form": {
    "round": "Етап {{round}}: {{result}}",
    "dnf": "схід",
    "dsq": "дискваліфікація"
  },
  "drivers": {
    "none": "Пілоти для цієї сесії відсутні."
  },
  "chart": {
    "round": "Етап",
    "roundN": "Етап {{round}}",
    "lap": "Коло",
    "lapN": "Коло {{lap}}",
    "lapLower": "коло {{lap}}",
    "noLaps": "Немає кіл для побудови графіка.",
    "noDelta": "Недостатньо даних для розрахунку відставання.",
    "noSpeed": "Немає даних про швидкість.",
    "noFeatures": "Дані про важливість ознак відсутні."
  },
  "tyres": {
    "noData": "немає даних"
  },
  "tabs": {
    "overview": "Огляд",
    "prediction": "Прогноз"
  },
  "session": {
    "notYet": "Ще не відбулась"
  },
  "charts": {
    "pitStop": "піт-стоп",
    "pitStopDuration": "піт-стоп {{value}}с",
    "pitStopLegend": "Піт-стоп",
    "tyreAge": "Вік шини: {{laps}} к.",
    "tyreAgeAxis": "Вік шини (кола)",
    "stintN": "Стінт {{stint}}",
    "noDegradation": "Недостатньо даних для кривої деградації.",
    "driversCount_one": "{{count}} пілот",
    "driversCount_few": "{{count}} пілоти",
    "driversCount_many": "{{count}} пілотів",
    "driversCount_other": "{{count}} пілота",
    "fieldMedian": "Медіана поля",
    "fieldBest": "Найкраще коло поля",
    "stopN": "стоп №{{stop}}",
    "noPitStops": "Піт-стопів немає.",
    "startToFinish": "Старт P{{grid}} → Фініш P{{position}}",
    "noChange": "без змін",
    "positionsDelta_one": "{{sign}}{{count}} позиція",
    "positionsDelta_few": "{{sign}}{{count}} позиції",
    "positionsDelta_many": "{{sign}}{{count}} позицій",
    "positionsDelta_other": "{{sign}}{{count}} позиції",
    "noGridData": "Недостатньо даних (потрібні старт і фініш).",
    "start": "Старт",
    "finish": "Фініш",
    "noStintSpread": "Недостатньо кіл у стінтах для розкиду темпу.",
    "best": "Найкраще",
    "median": "Медіана",
    "worst": "Найгірше"
  },
  "weather": {
    "time": "Час {{time}}",
    "none": "Дані про погоду відсутні.",
    "air": "Повітря",
    "track": "Траса",
    "humidity": "Вологість",
    "wind": "Вітер",
    "max": "Макс. {{value}}",
    "temperature": "Температура (°C)",
    "rainShaded": "дощ заштриховано",
    "humidityAxis": "Вологість (%)",
    "windAxis": "Вітер (м/с)",
    "windSpeed": "Швидкість вітру",
    "fieldPace": "Медіанний темп поля",
    "comparePace": "зіставити з погодою вище"
  },
  "laps": {
    "none": "Кола відсутні.",
    "driver": "Пілот",
    "lap": "Коло",
    "time": "Час",
    "tyre": "Шина",
    "tyreLife": "Життя",
    "position": "Поз.",
    "trackStatus": "Стан траси",
    "deleted": "Коло видалено",
    "used": "б/в",
    "prev": "Попередні",
    "next": "Наступні"
  },
  "summary": {
    "title": "Підсумок гонки",
    "sprint": "Спринт",
    "pole": "Поул",
    "startedFirst": "стартував першим",
    "fastestLap": "Найшвидше коло",
    "hero": "Герой гонки",
    "dnfs": "Сходи",
    "allFinished": "усі фінішували",
    "fromTo": "з P{{grid}} на P{{position}}",
    "fromPitLane": "з піт-лейну на P{{position}}"
  },
  "history": {
    "title": "Історія траси",
    "gpsHere": "Гран-прі тут",
    "firstIn": "уперше у {{year}}",
    "poleWin": "Перемога з поулу",
    "poleWinHint": "Частка гонок, які виграв пілот, що стартував першим",
    "lastN": "за останні {{count}}",
    "allTime": "{{value}} за всю історію",
    "mostWins": "Найбільше перемог",
    "lastWin": "востаннє {{year}}",
    "recentWinners": "Останні переможці",
    "grid": "Стартова позиція",
    "fromGrid": "зі старту P{{grid}}",
    "fromPitLane": "з піт-лейну"
  },
  "circuitCard": {
    "title": "Траса",
    "lapLength": "Довжина кола",
    "raceLaps": "Кіл у гонці",
    "distance": "дистанція ≈ {{value}} км",
    "corners": "Поворотів",
    "pitLoss": "Втрата на піт-стоп",
    "pitLossSc": "під SC {{sc}} · VSC {{vsc}}",
    "stopsPerDriver": "Піт-стопів на пілота",
    "avgOver_one": "середнє за {{count}} гонку",
    "avgOver_few": "середнє за {{count}} гонки",
    "avgOver_many": "середнє за {{count}} гонок",
    "avgOver_other": "середнє за {{count}} гонки",
    "fastestPitLane": "Найшвидший проїзд піт-лейну"
  },
  "standings": {
    "up": "Піднявся на {{count}}",
    "down": "Опустився на {{count}}",
    "beforeRound": "Чемпіонат перед етапом",
    "afterRound": "Чемпіонат після етапу",
    "fullTable": "Уся таблиця",
    "asOf": "станом на етап {{round}}"
  },
  "season": {
    "tabDrivers": "Пілоти",
    "tabTeams": "Команди",
    "tabCalendar": "Календар",
    "title": "Сезон",
    "titleYear": "Сезон {{year}}",
    "loadingStandings": "Завантажуємо чемпіонат {{year}}…",
    "noRacesYet": "У цьому сезоні ще не було жодної гонки.",
    "loadingCalendar": "Завантажуємо календар сезону {{year}}…",
    "search": "Пошук за назвою, містом, країною…",
    "searchLabel": "Пошук етапу"
  },
  "predictionCheck": {
    "title": "Прогноз моделі",
    "compute": "Порахувати",
    "notReady": "Прогноз для цього етапу ще не рахували. Перший розрахунок тренує модель і може тривати кілька хвилин.",
    "podiumTitle": "Прогноз моделі на подіум",
    "details": "Детальніше",
    "hits": "прогнозованих пілотів фінішували в топ-3",
    "actual": "Фактична позиція",
    "actualP": "факт P{{position}}"
  },
  "nextSession": {
    "title": "До наступної сесії"
  },
  "seasonNow": {
    "next": "Наступний етап · {{round}}",
    "until": "До",
    "ongoing": "Вікенд триває — результати незабаром.",
    "localTime": "Час — у вашому часовому поясі.",
    "prediction": "Прогноз моделі",
    "details": "Деталі етапу",
    "last": "Останній етап · {{round}}",
    "summary": "Підсумок",
    "noResults": "Результатів ще немає в датасеті.",
    "champion": "Чемпіон сезону",
    "leaders": "Лідери чемпіонату",
    "table": "Таблиця",
    "progress": "Прогрес сезону",
    "roundsDone": "Етапів позаду:"
  },
  "raceList": {
    "resultsPending": "результати очікуються",
    "winner": "Переможець: {{name}}",
    "next": "Наступний",
    "ongoing": "триває",
    "raceAt": "гонка {{time}}",
    "none": "Немає гонок для цього сезону."
  },
  "standingsTable": {
    "final": "Фінальна таблиця сезону.",
    "status": "Після етапу <b>{{done}}</b> з {{total}} · ще можна набрати <b>{{points}}</b> очок за пілота",
    "champion": "Чемпіон",
    "inContention": "у грі за титул",
    "fight": "Боротьба за титул",
    "fightFinal": "Як розгорталась боротьба за титул",
    "pos": "Поз.",
    "driver": "Пілот",
    "points": "Очки",
    "gap": "Відст.",
    "wins": "Перем.",
    "winsFull": "Перемоги",
    "podiums": "Подіуми",
    "qualiFirst": "1-й у квалі",
    "qualiFirstHint": "Перше місце в кваліфікації",
    "dnfs": "Сходи",
    "form": "Форма"
  },
  "teams": {
    "noPoints": "без очок",
    "title": "Кубок конструкторів",
    "wins_one": "{{count}} перемога",
    "wins_few": "{{count}} перемоги",
    "wins_many": "{{count}} перемог",
    "wins_other": "{{count}} перемоги",
    "podiums_one": "{{count}} подіум",
    "podiums_few": "{{count}} подіуми",
    "podiums_many": "{{count}} подіумів",
    "podiums_other": "{{count}} подіуму"
  },
  "eventCtx": {
    "profile": "Профіль сезону",
    "wasBefore": "було P{{position}} · <b>+{{points}} очк.</b> за етап",
    "afterFirst": "після першого етапу",
    "beforeOnly": "Перед етапом P{{position}}, {{points}} очк.",
    "vsTeammate": "Проти напарника в гонці",
    "quali": "Квалі",
    "race": "Гонка",
    "qualiFaster": "У кваліфікації швидший на {{value}}%",
    "qualiSlower": "У кваліфікації повільніший на {{value}}%",
    "noTeammate": "Даних про напарника на цьому етапі немає.",
    "history": "Раніше на цій трасі",
    "firstHere": "Перша гонка пілота на цій трасі.",
    "championship": "Чемпіонат"
  },
  "rating": {
    "title": "Оцінка сезону",
    "notEnough": "Замало гонок для оцінки (потрібно щонайменше 5).",
    "rank": "/ 100 · <b>{{rank}}-й</b> з {{of}} пілотів сезону",
    "lowData": "мало даних",
    "duels": "{{value}}% дуелей",
    "gained": "{{value}} поз. за гонку",
    "spread": "розкид ±{{value}} поз.",
    "races": "{{value}}% гонок",
    "pointsPerRace": "{{value}} очк. за гонку",
    "explain": "Кожна складова — перцентиль серед пілотів сезону з 5+ гонками (80 — кращий за 80% поля); оцінка — їх середнє. Вину в аваріях датасет не розрізняє.",
    "components": {
      "quali_vs_teammate": {
        "label": "Кваліфікація проти напарника",
        "hint": "частка виграних дуелей"
      },
      "race_vs_teammate": {
        "label": "Гонка проти напарника",
        "hint": "частка виграних дуелей, коли обидва фінішували"
      },
      "positions_gained": {
        "label": "Позиції в гонці",
        "hint": "середньо виграних позицій від старту до фінішу"
      },
      "consistency": {
        "label": "Стабільність",
        "hint": "розкид фінішних позицій (менше — краще)"
      },
      "incident_free": {
        "label": "Без аварій",
        "hint": "частка гонок без сходу через аварію чи зіткнення (вину датасет не розрізняє)"
      },
      "results": {
        "label": "Результати",
        "hint": "середньо очок за гонку"
      }
    }
  },
  "vsField": {
    "positions": "Позиції по колах",
    "positionsMate": "Позиції по колах — з напарником",
    "title": "Відносно поля",
    "pace": "Темп (медіана кіл)",
    "rank": "{{rank}}-й з {{of}} у полі",
    "vsMedian": "Проти медіани поля",
    "vsWinner": "Проти переможця ({{winner}})",
    "stops": "Піт-стопи",
    "fieldAvg": "у середньому в полі {{value}} с",
    "redFlagExcluded": "без {{count}} під червоним прапором",
    "explain": "Темп — медіана кіл без піт-стопів, першого кола й Safety Car. Піт-стоп — увесь проїзд піт-лейну."
  },
  "duel": {
    "faster": "швидший на {{value}}%",
    "slower": "повільніший на {{value}}%",
    "title": "Проти напарника",
    "titleMany": "Проти напарників",
    "vs": "проти",
    "together_one": "{{count}} гонка разом",
    "together_few": "{{count}} гонки разом",
    "together_many": "{{count}} гонок разом",
    "together_other": "{{count}} гонки разом",
    "quali": "Кваліфікація",
    "qualiHint": "Хто кваліфікувався вище",
    "medianGap": "У середньому (медіана) {{gap}} в одному сегменті кваліфікації",
    "race": "Гонка",
    "raceHint": "Лише гонки, де фінішували обидва",
    "pointsHint": "Очки в гонках, де їхали разом"
  },
  "resultsChart": {
    "pitLane": "піт-лейн",
    "dnf": "Схід"
  },
  "event": {
    "loadingSessions": "Завантажуємо список сесій етапу {{round}}…",
    "schedule": "Розклад",
    "loading": "Завантаження етапу…",
    "resultsPending": "Етап завершився, але його результатів ще немає в датасеті — підсумок зʼявиться після оновлення даних."
  },
  "driverPage": {
    "loading": "Завантажуємо дані пілота {{code}}…",
    "compare": "Порівняти",
    "updating": "Оновлюємо дані сесії {{session}}…",
    "position": "Позиція",
    "classified": "Класифікація",
    "fastestLap": "Найшвидше коло сесії",
    "tyreStrategy": "Стратегія шин",
    "degradation": "Крива деградації шини",
    "pace": "Темп по колах",
    "sectors": "Тренд по секторах",
    "stintSpread": "Розкид темпу по стінтах",
    "speedTraps": "Швидкість на пастках",
    "allLaps": "Усі кола"
  },
  "profile": {
    "gp": "Гран-прі",
    "champAfter": "Чемп.",
    "champAfterHint": "Місце в чемпіонаті після етапу",
    "pit": "піт",
    "career": "Кар'єра",
    "titles": "Титули",
    "seasons": "Сезони",
    "starts": "Старти",
    "fastestLaps": "Найшв. кола",
    "since2004": "дані з 2004",
    "debut": "Дебют: {{name}} {{year}} · команди: {{teams}}",
    "bestSeason": "найкращий сезон: {{year}} (P{{position}}, {{points}} очк.)",
    "team": "Команда",
    "place": "Місце",
    "ongoing": "сезон ще триває",
    "loading": "Завантажуємо профіль пілота…",
    "age_one": "{{count}} рік",
    "age_few": "{{count}} роки",
    "age_many": "{{count}} років",
    "age_other": "{{count}} року",
    "inChampionship": "у чемпіонаті {{year}} · {{points}} очк.",
    "pointsFinishes_one": "очки в {{count}} з {{total}} гонок",
    "pointsFinishes_few": "очки в {{count}} з {{total}} гонок",
    "pointsFinishes_many": "очки в {{count}} з {{total}} гонок",
    "pointsFinishes_other": "очки в {{count}} з {{total}} гонок",
    "incidents": "аварії/зіткнення: {{count}}",
    "none": "жодного",
    "bestFinish": "Найкращий фініш",
    "avgGrid": "Сер. старт",
    "avgFinish": "Сер. фініш",
    "finishesOnly": "лише фініші",
    "sprintPoints": "Очки у спринтах",
    "byRound": "Сезон {{year}} по етапах"
  },
  "analysis": {
    "stage": {
      "not_started": "До кваліфікації",
      "post_quali": "Після кваліфікації",
      "completed": "Гонка завершена"
    },
    "source": {
      "static_dataset": "дані з датасету",
      "live_fastf1_quali": "живі дані FastF1 (кваліфікація)",
      "live_no_quali": "живі дані, без кваліфікації"
    },
    "metric": {
      "podium_set": "Топ-3 (набір)",
      "top5_set": "Топ-5 (набір)",
      "top10_set": "Топ-10 (набір)"
    },
    "actual": "Факт",
    "hit": "Прогноз збігся",
    "generated": "Побудовано {{date}}",
    "refreshHint": "Перебудувати прогноз на сервері з найсвіжішими даними (напр. після кваліфікації). Може тривати кілька хвилин.",
    "refresh": "Оновити прогноз",
    "building": "Будуємо прогноз… перший запит по цьому етапу тренує модель, це може тривати довше за звичне",
    "quality": "Якість моделі",
    "empty": "Прогнозу немає.",
    "importancePosition": "Важливість ознак — позиція",
    "importanceDnf": "Важливість ознак — DNF"
  },
  "sessionPage": {
    "classifiedShort": "Кл.",
    "deltaStart": "Δ старт",
    "laps": "Кола",
    "status": "Статус",
    "bestLap": "Найкраще коло",
    "stopNo": "Стоп №",
    "duration": "Тривалість",
    "timeOfDay": "Час доби",
    "weather": "Погода",
    "results": "Результати",
    "csvBadge": "CSV — звужений набір полів",
    "csvSuggest": "Це триває довше за звичне — спробувати швидкий CSV-режим (менше полів, але миттєво)?",
    "csvTry": "Спробувати CSV",
    "noResults": "Результатів немає.",
    "loadingResults": "Завантажуємо результати сесії {{session}}…",
    "startFinish": "Старт → Фініш",
    "fastestStop": "Найшвидший: {{code}} {{value}}с",
    "pitTimeline": "Стрічка піт-стопів",
    "loadingLapsLong": "Завантажуємо кола сесії {{session}}… для гонки/практики це можуть бути сотні рядків",
    "loadingLaps": "Завантажуємо кола та пілотів сесії {{session}}…",
    "trackEvolution": "Еволюція траси",
    "speedTrapRanking": "Рейтинг спідтрапу (ST)",
    "bestLaps": "Найкращі кола (за /api/laps — результати практики малоінформативні)",
    "noLapsYet": "Кіл ще немає.",
    "pickDrivers": "Оберіть пілотів (для графіка темпу й порівняння)",
    "pickTwo": "Обери щонайменше 2 пілотів",
    "compareSelected": "Порівняти обраних",
    "loadingWeather": "Завантажуємо погоду сесії {{session}}…"
  },
  "compare": {
    "fastestLap": "Найшвидше коло — {{code}}",
    "lapTime": "Час кола",
    "sector": "Сектор {{n}}",
    "lapNumber": "Номер кола",
    "crumb": "Порівняння",
    "title": "Порівняння пілотів",
    "removeSlot": "Прибрати слот {{slot}}",
    "pickDriver": "Оберіть пілота…",
    "pickTwo": "Обери щонайменше 2 пілотів вище, щоб побачити порівняння.",
    "loading": "Завантажуємо порівняння {{drivers}}…",
    "lapTimes": "Час кіл",
    "gap": "Відставання по колах (кумулятивно, відносно {{code}})",
    "bestLapDelta": "Різниця найкращих кіл",
    "fastestLaps": "Найшвидші кола",
    "strategies": "Стратегії шин"
  }
};

export default uk;
