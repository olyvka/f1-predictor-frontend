// Race control (agent D): RaceControlPanel.jsx
// Access: t("live.events.<key>"). Only the widget owner edits this file.
// FIA message text is never translated - only chips, filters and labels.
const events = {
  title: "Race control",
  empty: "No race control messages yet",
  emptyFilter: {
    flag: "No flags yet",
    sc: "No safety car so far",
    penalty: "No incidents or penalties yet",
    other: "No other messages yet",
  },
  filtersLabel: "Message filter",
  filters: {
    all: "All",
    flag: "Flags",
    sc: "SC",
    penalty: "Incidents",
    other: "Other",
  },
  lap: "Lap {{lap}}",
  utcHint: "Local track time unknown - showing UTC",
  localHint: "Local track time (matches “TIMED AT” in FIA messages)",
  newMessages_one: "↑ {{count}} new",
  newMessages_other: "↑ {{count}} new",
  focusHint: "About the focused driver",
  flag: {
    green: "Green",
    clear: "Clear",
    yellow: "Yellow",
    "double-yellow": "Double yellow",
    blue: "Blue",
    red: "Red",
    chequered: "Chequered",
    bw: "Warning",
    black: "Black",
    "black-orange": "Mechanical",
    sc: "SC",
    vsc: "VSC",
    session: "Session",
    car: "Car",
    other: "Info",
  },
  toast: {
    pit: "{{tla}} · pit · {{lane}} in the pit lane",
    pitStop: "stop {{stop}}",
    fastest: "Fastest lap: {{tla}} {{time}}",
    seconds: "{{value}} s",
  },
};

export default events;
