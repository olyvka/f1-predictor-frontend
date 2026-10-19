import CircuitMap from "../circuit/CircuitMap";
import Section, { Fact } from "./Section";

const seconds = (v) => (v != null ? `${v.toFixed(1)} с` : "—");

// Схема траси + факти про неї. outline — статичний JSON (контур, повороти,
// втрата на піт-стоп з MultiViewer), facts — /api/circuit-facts (CSV).
// Будь-яке з двох може бути відсутнє — показуємо те, що є.
export default function CircuitCard({ outline, facts }) {
  if (!outline && !facts) return null;
  const name = facts?.circuit || outline?.circuit;
  const pitLoss = outline?.pit_loss;
  const distance = facts?.length_km && facts?.typical_laps ? facts.length_km * facts.typical_laps : null;

  return (
    <Section title="Траса">
      {outline && <CircuitMap outline={outline} className="w-full h-auto" />}
      <p className="text-sm font-semibold uppercase tracking-wide">{name}</p>

      <div className="flex flex-col">
        {facts?.length_km && <Fact label="Довжина кола">{facts.length_km.toFixed(3)} км</Fact>}
        {facts?.typical_laps && (
          <Fact label="Кіл у гонці" hint={distance ? `дистанція ≈ ${distance.toFixed(1)} км` : null}>
            {facts.typical_laps}
          </Fact>
        )}
        {outline?.corners?.length > 0 && <Fact label="Поворотів">{outline.corners.length}</Fact>}
        {pitLoss?.normal != null && (
          <Fact
            label="Втрата на піт-стоп"
            hint={pitLoss.sc != null ? `під SC ${seconds(pitLoss.sc)} · VSC ${seconds(pitLoss.vsc)}` : null}
          >
            {seconds(pitLoss.normal)}
          </Fact>
        )}
        {facts?.avg_pit_stops_per_driver != null && (
          <Fact label="Піт-стопів на пілота" hint={`середнє за ${facts.pit_data_races} гонок`}>
            {facts.avg_pit_stops_per_driver.toFixed(1)}
          </Fact>
        )}
        {facts?.fastest_pit_stop && (
          // У датасеті тривалість — весь проїзд піт-лейну, а не ~2 с
          // зупинки, які показують у трансляції. Підписуємо саме так.
          <Fact
            label="Найшвидший проїзд піт-лейну"
            hint={`${facts.fastest_pit_stop.code || facts.fastest_pit_stop.full_name}, ${facts.fastest_pit_stop.year}`}
          >
            {seconds(facts.fastest_pit_stop.duration)}
          </Fact>
        )}
      </div>
    </Section>
  );
}
