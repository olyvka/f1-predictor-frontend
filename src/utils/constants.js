import i18n from "../i18n";

// Розшифровки кодів, яких бекенд не надає (див. розділ 10 техдоку) —
// власні словники-мапи на фронті.

export const TYRE_COLORS = {
  SOFT: "#ff5c5c",
  MEDIUM: "#ffd400",
  HARD: "#f2f2f2",
  INTERMEDIATE: "#43b04a",
  WET: "#2f80ed",
  UNKNOWN: "#6b7280", // = FALLBACK_TEAM_COLOR
};

export function tyreColor(compound) {
  return TYRE_COLORS[compound?.toUpperCase()] || TYRE_COLORS.UNKNOWN;
}

const TYRE_LETTERS = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

export function tyreLetter(compound) {
  return TYRE_LETTERS[compound?.toUpperCase()] || "?";
}

// Коди стану траси (FastF1 `TrackStatus`) — рядок може містити кілька
// символів одного кола (напр. "24" = жовті + SC одночасно).
// Підписи кодів — у словниках i18n (trackStatus.1…7).
const TRACK_STATUS_CODES = new Set(["1", "2", "3", "4", "5", "6", "7"]);

export function decodeTrackStatus(status) {
  if (!status) return [];
  return [...String(status)].map((ch) =>
    TRACK_STATUS_CODES.has(ch) ? i18n.t(`trackStatus.${ch}`) : i18n.t("trackStatus.unknown", { code: ch })
  );
}

// Стисла категорія для банерів/фону на графіках темпу: найсерйозніший
// прапор коду, якщо їх кілька одночасно (напр. "24" → safety-car).
export function trackStatusSeverity(status) {
  if (!status) return null;
  const codes = new Set(String(status));
  if (codes.has("5")) return "red";
  if (codes.has("4") || codes.has("6") || codes.has("7") || codes.has("3")) return "safety-car";
  if (codes.has("2")) return "yellow";
  return null; // "1" (чисто) чи невідомий код — нічого не підсвічуємо
}

export const FLAG_BAND_COLORS = {
  yellow: "var(--color-warn)",
  "safety-car": "#4f7cff",
  red: "var(--color-danger)",
};

/** Легенда смуг прапорів на графіках темпу — мовою інтерфейсу. */
export function flagBandLabels() {
  return {
    yellow: i18n.t("flags.yellow"),
    "safety-car": i18n.t("flags.safetyCar"),
    red: i18n.t("flags.red"),
  };
}

// ClassifiedPosition поза числовими позиціями (R/D/W/E/N) — у словниках i18n.
const CLASSIFIED_CODES = new Set(["R", "D", "W", "E", "N"]);

export function classifiedPositionLabel(value) {
  if (value == null || value === "") return "—";
  return CLASSIFIED_CODES.has(value) ? i18n.t(`classified.${value}`) : value;
}

// Фолбеки, коли бекенд не віддав TeamColor (буває для старих сезонів):
// сірий — для крапок/бордерів команди, світлий — для ліній на графіках,
// щоб лінія лишалась помітною на темному фоні.
export const FALLBACK_TEAM_COLOR = "#6b7280";
export const FALLBACK_SERIES_COLOR = "#e8eaed";

// FastF1-ендпоінти віддають TeamColor без "#", CSV-ендпоінти (event-summary
// тощо) — з "#". Одна точка нормалізації для обох.
export function teamHex(color, fallback = FALLBACK_TEAM_COLOR) {
  if (!color) return fallback;
  return color.startsWith("#") ? color : `#${color}`;
}

// Причини сходу з датасету (status.csv) — англійською, як в Ergast.
// Покрито всі статуси гонок з 2010 року; рідкісні старші лишаються як є.
const RETIREMENT_LABELS = {
  Collision: "Зіткнення",
  Accident: "Аварія",
  Engine: "Двигун",
  Gearbox: "Коробка передач",
  "Collision damage": "Пошкодження після зіткнення",
  Brakes: "Гальма",
  Retired: "Сход",
  Hydraulics: "Гідравліка",
  Suspension: "Підвіска",
  "Power Unit": "Силова установка",
  Electrical: "Електрика",
  Wheel: "Колесо",
  "Spun off": "Розворот",
  Disqualified: "Дискваліфікація",
  Withdrew: "Знявся",
  "Oil leak": "Витік оливи",
  Mechanical: "Механіка",
  Puncture: "Прокол",
  "Power loss": "Втрата потужності",
  Overheating: "Перегрів",
  "Water pressure": "Тиск води",
  Transmission: "Трансмісія",
  "Fuel pressure": "Тиск палива",
  "Wheel nut": "Гайка колеса",
  Battery: "Батарея",
  Exhaust: "Вихлоп",
  Clutch: "Зчеплення",
  "Rear wing": "Заднє антикрило",
  "Water leak": "Витік води",
  ERS: "ERS",
  Turbo: "Турбіна",
  Throttle: "Дросель",
  Vibrations: "Вібрації",
  Vibration: "Вібрації",
  Electronics: "Електроніка",
  Tyre: "Шина",
  Undertray: "Днище",
  Steering: "Кермо",
  "Front wing": "Переднє антикрило",
  "Did not qualify": "Не кваліфікувався",
  "Fuel system": "Паливна система",
  Technical: "Технічна причина",
  Driveshaft: "Привідний вал",
  Alternator: "Генератор",
  Radiator: "Радіатор",
  Illness: "Хвороба",
  "Fuel pump": "Паливний насос",
  "Oil pressure": "Тиск оливи",
  Seat: "Сидіння",
  Damage: "Пошкодження",
  "Fuel leak": "Витік палива",
  Underweight: "Недостатня вага",
  Handling: "Керованість",
  "Track rod": "Рульова тяга",
  "Engine misfire": "Пропуски запалювання",
  "Heat shield fire": "Пожежа теплозахисту",
  Pneumatics: "Пневматика",
  Drivetrain: "Трансмісія",
  "Brake duct": "Повітропровід гальм",
  Excluded: "Виключений",
  Injury: "Травма",
  "Spark plugs": "Свічки запалювання",
  "Out of fuel": "Скінчилось паливо",
  Debris: "Уламки",
  "Cooling system": "Охолодження",
  "Water pump": "Водяний насос",
  Differential: "Диференціал",
  "Safety switch": "Аварійний вимикач",
};

export function retirementLabel(status) {
  // Датасет і так англійською — перекладаємо лише для української.
  if (i18n.language === "en") return status;
  return RETIREMENT_LABELS[status] || status;
}

// Національності з датасету (drivers.csv) — англійською, як в Ergast.
// Покрито всіх пілотів з 1990 року; старші лишаються як є.
const NATIONALITY_LABELS = {
  American: "США",
  Argentine: "Аргентина",
  Argentinian: "Аргентина",
  Australian: "Австралія",
  Austrian: "Австрія",
  Belgian: "Бельгія",
  Brazilian: "Бразилія",
  British: "Велика Британія",
  Canadian: "Канада",
  Chinese: "Китай",
  Colombian: "Колумбія",
  Czech: "Чехія",
  Danish: "Данія",
  Dutch: "Нідерланди",
  Finnish: "Фінляндія",
  French: "Франція",
  German: "Німеччина",
  Hungarian: "Угорщина",
  Indian: "Індія",
  Indonesian: "Індонезія",
  Irish: "Ірландія",
  Italian: "Італія",
  Japanese: "Японія",
  Malaysian: "Малайзія",
  Mexican: "Мексика",
  Monegasque: "Монако",
  "New Zealander": "Нова Зеландія",
  Polish: "Польща",
  Portuguese: "Португалія",
  Russian: "Росія",
  Spanish: "Іспанія",
  Swedish: "Швеція",
  Swiss: "Швейцарія",
  Thai: "Таїланд",
  Venezuelan: "Венесуела",
};

export function nationalityLabel(nationality) {
  if (!nationality) return null;
  const key = nationality.trim(); // у датасеті трапляється "Argentinian " з пробілом
  if (i18n.language === "en") return key;
  return NATIONALITY_LABELS[key] || key;
}
