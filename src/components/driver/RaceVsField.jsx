import { formatLapTime } from "../../utils/time";
import { teamHex } from "../../utils/constants";
import PositionChart from "../charts/PositionChart";
import Section, { Fact } from "../overview/Section";
import { t } from "../../i18n";

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Медіана чистих кіл пілота — стійка до трафіку й поодиноких помилок.
function paceByDriver(laps) {
  const byDriver = new Map();
  laps.forEach((l) => {
    if (l.IsAccurate === false || l.LapTime == null) return;
    if (!byDriver.has(l.Driver)) byDriver.set(l.Driver, []);
    byDriver.get(l.Driver).push(l.LapTime);
  });
  return new Map([...byDriver].filter(([, t]) => t.length >= 3).map(([d, t]) => [d, median(t)]));
}

function diff(a, b) {
  const d = a - b;
  return t("units.secondsSpaced", { value: `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(3)}` });
}

// Гонка відносно всього поля: темп, позиції по колах (пілот і напарник),
// піт-стопи проти середнього. allLaps — /api/laps усієї сесії.
export default function RaceVsField({ allLaps, code, mateCode, teamColor, pitStops }) {
  const pace = paceByDriver(allLaps);
  const mine = pace.get(code);
  const ranked = [...pace.entries()].sort((a, b) => a[1] - b[1]);
  const rank = ranked.findIndex(([d]) => d === code) + 1;
  const fieldMedian = median([...pace.values()]);
  const lastLapOf = new Map();
  allLaps.forEach((l) => {
    if (l.Position != null && (!lastLapOf.has(l.Driver) || l.LapNumber > lastLapOf.get(l.Driver).LapNumber)) {
      lastLapOf.set(l.Driver, l);
    }
  });
  const winner = [...lastLapOf.values()].find((l) => l.Position === 1)?.Driver;

  const positionSeries = [code, mateCode]
    .filter(Boolean)
    .map((c, i) => ({
      code: c,
      color: teamHex(teamColor),
      dash: i === 1,
      laps: allLaps.filter((l) => l.Driver === c && l.Position != null),
    }))
    .filter((s) => s.laps.length);

  // Довші за хвилину — "стопи" під час зупинки гонки червоним прапором, не
  // справжні піт-стопи; не рахуємо ні в пілота, ні в середньому по полю.
  const realStop = (p) => p.duration != null && p.duration < 60;
  const myStops = (pitStops || []).filter((p) => p.code === code && realStop(p));
  const redFlagStops = (pitStops || []).filter((p) => p.code === code && p.duration >= 60).length;
  const allStops = (pitStops || []).filter(realStop);
  const avgStop = allStops.length ? allStops.reduce((s, p) => s + p.duration, 0) / allStops.length : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
      {positionSeries.length > 0 && (
        <Section title={mateCode ? t("vsField.positionsMate") : t("vsField.positions")}>
          <PositionChart series={positionSeries} height={240} />
        </Section>
      )}

      <Section title={t("vsField.title")}>
        <div className="flex flex-col">
          {mine != null && (
            <Fact label={t("vsField.pace")} hint={rank ? t("vsField.rank", { rank, of: ranked.length }) : null}>
              {formatLapTime(mine)}
            </Fact>
          )}
          {mine != null && fieldMedian != null && <Fact label={t("vsField.vsMedian")}>{diff(mine, fieldMedian)}</Fact>}
          {mine != null && winner && winner !== code && pace.get(winner) != null && (
            <Fact label={t("vsField.vsWinner", { winner })}>{diff(mine, pace.get(winner))}</Fact>
          )}
          {(myStops.length > 0 || redFlagStops > 0) && (
            <Fact
              label={myStops.length ? `${t("vsField.stops")} · ${myStops.length}` : t("vsField.stops")}
              hint={[
                avgStop != null && t("vsField.fieldAvg", { value: avgStop.toFixed(1) }),
                redFlagStops > 0 && t("vsField.redFlagExcluded", { count: redFlagStops }),
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {myStops.length ? myStops.map((p) => t("units.secondsSpaced", { value: p.duration.toFixed(1) })).join(", ") : "—"}
            </Fact>
          )}
        </div>
        <p className="text-[11px] text-(--color-text-dim)">
          {t("vsField.explain")}
        </p>
      </Section>
    </div>
  );
}
