import { Link } from "react-router-dom";
import { Trans } from "react-i18next";
import Section from "../overview/Section";
import DriverAvatar from "../overview/DriverAvatar";
import { t } from "../../i18n";

function labelText(label) {
  return label === "DNF" || label === "DSQ" ? label : `P${label}`;
}

function labelTone(label) {
  if (label === "DNF" || label === "DSQ") return "text-(--color-danger)";
  if (Number(label) <= 3) return "text-(--color-accent) font-bold";
  return "";
}

// Контекст пілота на етапі (з CSV): чемпіонат до/після, дуель з напарником
// у цій гонці, його результати на цій трасі раніше. driver — рядок FastF1
// (FullName/HeadshotUrl), ctx — /api/driver-event.
export default function EventContext({ ctx, year, driver }) {
  const { championship: ch, teammate: tm, circuit_history: history } = ctx;
  const me = { full_name: driver.FullName, code: driver.Abbreviation, headshot_url: driver.HeadshotUrl, team_color: driver.TeamColor };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
      <Section title={t("eventCtx.championship")} action={{ to: `/${year}/drivers/${ctx.driver_ref}`, label: t("eventCtx.profile") }}>
        {ch.after ? (
          <div className="flex items-baseline gap-3">
            <span className="font-mono-data text-2xl font-bold">P{ch.after.position}</span>
            <span className="text-sm text-(--color-text-dim)">
              {ch.before ? (
                <Trans
                  i18nKey="eventCtx.wasBefore"
                  values={{ position: ch.before.position, points: ch.after.points - ch.before.points }}
                  components={{ b: <span className="text-(--color-text)" /> }}
                />
              ) : (
                t("eventCtx.afterFirst")
              )}
            </span>
          </div>
        ) : (
          <p className="text-sm text-(--color-text-dim)">
            {ch.before ? t("eventCtx.beforeOnly", { position: ch.before.position, points: ch.before.points }) : t("seasonNow.noResults")}
          </p>
        )}
      </Section>

      <Section title={t("eventCtx.vsTeammate")}>
        {tm ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <DriverAvatar driver={me} size={28} />
              <span className="text-xs text-(--color-text-dim)">{t("duel.vs")}</span>
              <Link to={`/${year}/drivers/${tm.driver_ref}`} className="flex items-center gap-2 min-w-0 group">
                <DriverAvatar driver={tm} size={28} />
                <span className="font-semibold truncate group-hover:text-(--color-accent) transition-colors">{tm.code || tm.full_name}</span>
              </Link>
            </div>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 font-mono-data">
              <span />
              <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-sans">{me.code}</span>
              <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-sans">{tm.code}</span>
              <span className="text-(--color-text-dim) font-sans">{t("eventCtx.quali")}</span>
              <span className={tm.quali.mine < tm.quali.mate ? "font-bold" : ""}>{tm.quali.mine ? `P${tm.quali.mine}` : "—"}</span>
              <span className={tm.quali.mate < tm.quali.mine ? "font-bold" : ""}>{tm.quali.mate ? `P${tm.quali.mate}` : "—"}</span>
              <span className="text-(--color-text-dim) font-sans">{t("eventCtx.race")}</span>
              <span className={labelTone(tm.race.mine)}>{labelText(tm.race.mine)}</span>
              <span className={labelTone(tm.race.mate)}>{labelText(tm.race.mate)}</span>
              <span className="text-(--color-text-dim) font-sans">{t("standingsTable.points")}</span>
              <span>{tm.points.mine}</span>
              <span>{tm.points.mate}</span>
            </div>
            {tm.quali.gap_pct != null && (
              <p className="text-xs text-(--color-text-dim)">
                {t(tm.quali.gap_pct < 0 ? "eventCtx.qualiFaster" : "eventCtx.qualiSlower", { value: Math.abs(tm.quali.gap_pct).toFixed(2) })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-(--color-text-dim)">{t("eventCtx.noTeammate")}</p>
        )}
      </Section>

      <Section title={t("eventCtx.history")}>
        {history.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {history.map((h) => (
              <li
                key={h.year}
                className="border border-(--color-line) rounded px-2 py-1 text-xs font-mono-data"
                title={`${h.team} · ${h.grid ? t("history.fromGrid", { grid: h.grid }) : t("history.fromPitLane")}`}
              >
                <span className="text-(--color-text-dim)">{h.year}</span>{" "}
                <span className={labelTone(h.label)}>{labelText(h.label)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-(--color-text-dim)">{t("eventCtx.firstHere")}</p>
        )}
      </Section>
    </div>
  );
}
