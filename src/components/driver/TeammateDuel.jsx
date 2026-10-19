import { Link } from "react-router-dom";
import DriverAvatar from "../overview/DriverAvatar";
import Section from "../overview/Section";

// Рахунок дуелі смужкою: частка пілота — акцентом, напарника — тьмяно.
function DuelBar({ label, won, lost, hint }) {
  const total = won + lost;
  return (
    <div className="flex flex-col gap-1" title={hint}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-(--color-text-dim)">{label}</span>
        <span className="font-mono-data font-bold">
          {won} : {lost}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-(--color-line)">
        {total > 0 && (
          <>
            <span className="bg-(--color-accent)" style={{ width: `${(won / total) * 100}%` }} />
            <span className="bg-(--color-text-dim)/50" style={{ width: `${(lost / total) * 100}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

function gapText(pct) {
  if (pct == null) return null;
  const faster = pct < 0;
  return `${faster ? "швидший" : "повільніший"} на ${Math.abs(pct).toFixed(2)}%`;
}

// Напарник має ту саму машину — найчесніше мірило пілота.
export default function TeammateDuel({ driver, teammates, year }) {
  if (!teammates?.length) return null;
  return (
    <Section title={teammates.length > 1 ? "Проти напарників" : "Проти напарника"}>
      {teammates.map((t) => (
        <div key={t.driver_ref} className="flex flex-col gap-3 pt-3 border-t border-(--color-line) first:border-t-0 first:pt-0">
          <div className="flex items-center gap-3">
            <DriverAvatar driver={driver} size={36} />
            <span className="text-(--color-text-dim) text-xs">проти</span>
            <Link to={`/${year}/drivers/${t.driver_ref}`} className="flex items-center gap-2 group min-w-0">
              <DriverAvatar driver={t} size={36} />
              <span className="font-semibold truncate group-hover:text-(--color-accent) transition-colors">{t.full_name}</span>
            </Link>
            <span className="ml-auto text-xs text-(--color-text-dim) shrink-0">{t.races} гонок разом</span>
          </div>
          <DuelBar label="Кваліфікація" won={t.quali.won} lost={t.quali.lost} hint="Хто кваліфікувався вище" />
          {t.quali_gap_pct_median != null && (
            <p className="text-xs text-(--color-text-dim) -mt-1.5">
              У середньому (медіана) {gapText(t.quali_gap_pct_median)} в одному сегменті кваліфікації
            </p>
          )}
          <DuelBar label="Гонка" won={t.race.won} lost={t.race.lost} hint="Лише гонки, де фінішували обидва" />
          <DuelBar label="Очки" won={t.points.mine} lost={t.points.mate} hint="Очки в гонках, де їхали разом" />
        </div>
      ))}
    </Section>
  );
}
