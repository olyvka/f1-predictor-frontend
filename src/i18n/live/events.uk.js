// Race control (агент D): RaceControlPanel.jsx
// Доступ: t("live.events.<ключ>"). Цей файл редагує лише власник віджета.
// Текст повідомлень FIA не перекладаємо - лише чіпи, фільтри й підписи.
const events = {
  title: "Race control",
  empty: "Повідомлень від дирекції ще не було",
  emptyFilter: {
    flag: "Прапорів ще не було",
    sc: "Safety car ще не виїжджав",
    penalty: "Порушень і розслідувань ще не було",
    other: "Інших повідомлень ще не було",
  },
  filtersLabel: "Фільтр повідомлень",
  filters: {
    all: "Усі",
    flag: "Прапори",
    sc: "SC",
    penalty: "Порушення",
    other: "Інше",
  },
  lap: "Коло {{lap}}",
  utcHint: "Місцевий час траси невідомий - показано UTC",
  localHint: "Місцевий час траси (як «TIMED AT» у повідомленнях FIA)",
  newMessages_one: "↑ {{count}} нове",
  newMessages_few: "↑ {{count}} нові",
  newMessages_many: "↑ {{count}} нових",
  newMessages_other: "↑ {{count}} нових",
  focusHint: "Стосується пілота у фокусі",
  flag: {
    green: "Зелений",
    clear: "Чисто",
    yellow: "Жовтий",
    "double-yellow": "Подвійний жовтий",
    blue: "Синій",
    red: "Червоний",
    chequered: "Фініш",
    bw: "Попередження",
    black: "Чорний",
    "black-orange": "Несправність",
    sc: "SC",
    vsc: "VSC",
    session: "Сесія",
    car: "Машина",
    other: "Інфо",
  },
  toast: {
    pit: "{{tla}} · піт · {{lane}} у піт-лейні",
    pitStop: "зупинка {{stop}}",
    fastest: "Найшвидше коло: {{tla}} {{time}}",
    seconds: "{{value}} с",
  },
};

export default events;
