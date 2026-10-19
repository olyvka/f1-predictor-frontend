import CircuitMap from "../circuit/CircuitMap";
import Section, { Fact } from "./Section";
import { t } from "../../i18n";

const seconds = (v) => (v != null ? t("units.secondsSpaced", { value: v.toFixed(1) }) : "—");

// Схема траси + факти про неї. outline — статичний JSON (контур, повороти,
// втрата на піт-стоп з MultiViewer), facts — /api/circuit-facts (CSV).
// Будь-яке з двох може бути відсутнє — показуємо те, що є.
export default function CircuitCard({ outline, facts }) {
  if (!outline && !facts) return null;
  const name = facts?.circuit || outline?.circuit;
  const pitLoss = outline?.pit_loss;
  const distance = facts?.length_km && facts?.typical_laps ? facts.length_km * facts.typical_laps : null;

  return (
    <Section title={t("circuitCard.title")}>
      {outline && <CircuitMap outline={outline} className="w-full h-auto" />}
      <p className="text-sm font-semibold uppercase tracking-wide">{name}</p>

      <div className="flex flex-col">
        {facts?.length_km && <Fact label={t("circuitCard.lapLength")}>{t("units.km", { value: facts.length_km.toFixed(3) })}</Fact>}
        {facts?.typical_laps && (
          <Fact label={t("circuitCard.raceLaps")} hint={distance ? t("circuitCard.distance", { value: distance.toFixed(1) }) : null}>
            {facts.typical_laps}
          </Fact>
        )}
        {outline?.corners?.length > 0 && <Fact label={t("circuitCard.corners")}>{outline.corners.length}</Fact>}
        {pitLoss?.normal != null && (
          <Fact
            label={t("circuitCard.pitLoss")}
            hint={pitLoss.sc != null ? t("circuitCard.pitLossSc", { sc: seconds(pitLoss.sc), vsc: seconds(pitLoss.vsc) }) : null}
          >
            {seconds(pitLoss.normal)}
          </Fact>
        )}
        {facts?.avg_pit_stops_per_driver != null && (
          <Fact label={t("circuitCard.stopsPerDriver")} hint={t("circuitCard.avgOver", { count: facts.pit_data_races })}>
            {facts.avg_pit_stops_per_driver.toFixed(1)}
          </Fact>
        )}
        {facts?.fastest_pit_stop && (
          // У датасеті тривалість — весь проїзд піт-лейну, а не ~2 с
          // зупинки, які показують у трансляції. Підписуємо саме так.
          <Fact
            label={t("circuitCard.fastestPitLane")}
            hint={`${facts.fastest_pit_stop.code || facts.fastest_pit_stop.full_name}, ${facts.fastest_pit_stop.year}`}
          >
            {seconds(facts.fastest_pit_stop.duration)}
          </Fact>
        )}
      </div>
    </Section>
  );
}
