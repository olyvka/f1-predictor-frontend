// Бекенд віддає назву країни рядком (напр. "Bahrain"), не ISO-код, тому
// прапор — власна мапа назва → емодзі. Немає в мапі — просто без прапора,
// а не зламаний рендер.
const FLAGS = {
  bahrain: "🇧🇭",
  "saudi arabia": "🇸🇦",
  australia: "🇦🇺",
  japan: "🇯🇵",
  china: "🇨🇳",
  "united states": "🇺🇸",
  usa: "🇺🇸",
  italy: "🇮🇹",
  monaco: "🇲🇨",
  canada: "🇨🇦",
  spain: "🇪🇸",
  austria: "🇦🇹",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  hungary: "🇭🇺",
  belgium: "🇧🇪",
  netherlands: "🇳🇱",
  azerbaijan: "🇦🇿",
  singapore: "🇸🇬",
  mexico: "🇲🇽",
  brazil: "🇧🇷",
  qatar: "🇶🇦",
  "united arab emirates": "🇦🇪",
  uae: "🇦🇪",
  germany: "🇩🇪",
  france: "🇫🇷",
  portugal: "🇵🇹",
  turkey: "🇹🇷",
  russia: "🇷🇺",
  "south korea": "🇰🇷",
  india: "🇮🇳",
  malaysia: "🇲🇾",
  "south africa": "🇿🇦",
  argentina: "🇦🇷",
};

export function countryFlag(country) {
  if (!country) return null;
  return FLAGS[country.trim().toLowerCase()] || null;
}
