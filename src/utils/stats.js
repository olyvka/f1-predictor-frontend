// Спільна статистика для графіків, де потрібен розкид/медіана по полю
// (box-plot стінтів, еволюція траси) — щоб не дублювати квантиль-функцію.
export function quantile(sortedValues, q) {
  if (!sortedValues.length) return null;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sortedValues[base + 1] !== undefined
    ? sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
    : sortedValues[base];
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}
