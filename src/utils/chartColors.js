// Кольори ліній на графіках чемпіонату (вкладки "Пілоти" / "Команди").

// Кольори команд відомі лише з 2023 (довідник driver_media) — для старших
// сезонів лінії інакше були б однаково сірі. Палітра з токенів теми.
const FALLBACK_PALETTE = ["#e5344c", "#4f7cff", "#3ecf7e", "#f5a623", "#b06cff", "#2ec4c4"];

export function seriesColor(teamColor, index) {
  return teamColor || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

// Однаковий колір у напарників — другий у тій самій команді пунктиром.
export function withTeammateDashes(items) {
  const seen = new Set();
  return items.map((it) => {
    const dash = seen.has(it.color);
    seen.add(it.color);
    return { ...it, dash };
  });
}
