import Section from "./Section";

// Прогноз моделі на подіум проти факту. Статус лише читає кеш бекенду —
// якщо прогноз ще не рахували (перший розрахунок тренує модель і триває
// хвилини), не запускаємо його звідси, а ведемо на сторінку "Прогноз".
export default function PredictionCheck({ status }) {
  if (!status) return null;

  if (!status.ready) {
    return (
      <Section title="Прогноз моделі" action={{ to: "analysis", label: "Порахувати" }}>
        <p className="text-sm text-(--color-text-dim)">
          Прогноз для цього етапу ще не рахували. Перший розрахунок тренує модель і може тривати кілька хвилин.
        </p>
      </Section>
    );
  }

  const hasActuals = status.top3.some((p) => p.actual_position != null);

  return (
    <Section title="Прогноз моделі на подіум" action={{ to: "analysis", label: "Детальніше" }}>
      {hasActuals && status.hits != null && (
        <p className="text-sm">
          <span className="font-mono-data text-2xl font-bold text-(--color-accent)">{status.hits}/3</span>
          <span className="text-(--color-text-dim)"> прогнозованих пілотів фінішували в топ-3</span>
        </p>
      )}
      <ol className="flex flex-col text-sm">
        {status.top3.map((p) => {
          const hit = p.actual_position != null && p.actual_position <= 3;
          return (
            <li
              key={p.predicted_position}
              className="flex items-baseline gap-3 py-1.5 border-t border-(--color-line) first:border-t-0"
            >
              <span className="font-mono-data text-(--color-text-dim) w-6">P{p.predicted_position}</span>
              <span className="flex-1 min-w-0 truncate">
                <span className="font-semibold">{p.driver}</span>
                <span className="text-(--color-text-dim)"> · {p.team}</span>
              </span>
              {hasActuals && (
                <span
                  className={`font-mono-data shrink-0 ${hit ? "text-(--color-good) font-semibold" : "text-(--color-text-dim)"}`}
                  title="Фактична позиція"
                >
                  {p.actual_position != null ? `факт P${p.actual_position}` : "сход"}
                  {hit && " ✓"}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
