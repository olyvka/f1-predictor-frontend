// Карта траси (агент B): TrackMap.jsx
// Доступ: t("live.map.<ключ>"). Цей файл редагує лише власник віджета.
const map = {
  title: "Track map",
  canvasLabel:
    "Track map with live car positions. Click or tap a car to select the driver; with a keyboard, select drivers in the positions table.",
  labels: {
    group: "Map labels",
    focus: "Focus",
    focusHint: "Label only the selected driver (the leader if none is selected)",
    top: "Top 5",
    topHint: "Top five plus the selected driver",
    all: "All",
    allHint: "All drivers; three or more bunched cars share one label like “VER +2”",
  },
  rotate: "90°",
  rotateHint: "Rotate the map by 90°",
  forming: "building the outline…",
  waiting: "Waiting for track data…",
  legend: {
    pit: "faded - in the pit lane",
    teammate: "white dot - team's second driver",
  },
  flag: {
    label: "Track-wide flag",
    SC: "SC",
    VSC: "VSC",
    RED: "Red flag",
  },
  tooltip: {
    position: "P{{position}}",
    pit: "PIT",
    stale: "no data",
  },
  summary: {
    focus: "Focused: {{driver}}",
    position: "position {{position}}",
    pit: "in the pit lane",
    gone: "not on track",
    none: "No driver selected",
  },
};

export default map;
