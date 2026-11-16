// Статус-бар сесії (A у LIVE_UI_RESEARCH §3).
// Завдання: L5 (годинник «від старту» і «Коло X / Y» - разом із ReplayControls),
// L13 (бейдж REPLAY ×N / LIVE · затримка), L14 (індикатор свіжості/застарілих даних).
// Дизайн: LIVE_UI_RESEARCH W1, §5.6. Власник: агент A.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
// Погода показується окремим віджетом WeatherChips у тому ж рядку (сторінка
// ставить його поруч), тут її не малюємо.
//
// Свіжість (W1): «дані свіжі» / «буферизація» (status buffering - clock не
// росте) / «немає даних > 10 с» (clock − lastEventAt у часі сесії). Клік на
// індикатор показує технічні деталі. Чіп «Зелений» - 5 с після TRACK CLEAR,
// «Фініш» - після клетчастого прапора (банером їх не показуємо).
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useClockLocal, useLapCounter, useLiveSelector, useReplay, useSession, useTrackStatus } from "../../live/hooks";
import { formatClock } from "../../live/format";
import { freshnessState, isQualifyingSession, latestQualifyingPhase, sessionNameKey, trackChip } from "./TimingTower/logic";
import "./TimingTower/tower.css";

function utcTime(ms) {
  if (ms == null) return "—";
  return new Date(ms).toISOString().slice(11, 19);
}

export default function StatusBar({ layout = "desktop" }) {
  const { t, i18n } = useTranslation();
  const { session, ready } = useSession();
  const { status, speed, mode, paused, sessionStart, lastEventAt, lastBatchAt, epoch } = useReplay();
  const clock = useClockLocal();
  const lap = useLapCounter();
  const { status: track } = useTrackStatus();
  const qPhase = useLiveSelector("rc", (s) => latestQualifyingPhase(s.raceControl));
  const mobile = layout === "mobile";

  const elapsed = clock != null && sessionStart != null ? (clock - sessionStart) / 1000 : null;
  const fresh = freshnessState({ status, paused, clock, lastEventAt });
  const chip = trackChip(track, clock);

  const countryRaw = session?.country_name || "";
  const country = (i18n.getResource(i18n.language, "translation", `live.tower.country.${countryRaw}`) ?? countryRaw) || "";
  const nameKey = sessionNameKey(session?.session_name);
  const sessionName = nameKey ? t(`live.tower.sessionName.${nameKey}`) : session?.session_name || "";
  const title = ready ? t("live.tower.status.title", { country, year: session.year ?? "" }).trim() : t("live.common.loadingSession");

  const isLive = mode === "live";
  const badgeTitle = isLive ? t("live.tower.status.liveFull") : t("live.tower.status.replayFull", { speed });

  return (
    <div
      className="relative flex flex-wrap items-center gap-x-4 gap-y-1 h-full bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 min-w-0"
      role="group"
      aria-label={t("live.tower.status.label")}
    >
      <span className="lt-badge" data-mode={isLive ? "live" : "replay"} title={badgeTitle}>
        {isLive && <i className="lt-live-dot" aria-hidden="true" />}
        {isLive ? (
          <>
            {t("live.common.liveBadge")}
            {!mobile && <span className="font-normal normal-case tracking-normal">· {t("live.tower.status.liveDelay")}</span>}
          </>
        ) : (
          <span className="tabular">
            {t("live.common.replayBadge")} ×{speed}
          </span>
        )}
      </span>

      <div className="flex flex-col min-w-0 leading-tight">
        <strong className="uppercase text-[15px] font-bold tracking-wide truncate">
          {title}
          {ready && sessionName && <span className="text-(--color-text-dim) font-semibold"> · {sessionName}</span>}
        </strong>
        {ready && !mobile && session.circuit_short_name && <span className="text-xs text-(--color-text-dim) truncate">{session.circuit_short_name}</span>}
      </div>

      {lap.isRace && (
        <div className="flex items-baseline gap-1.5" title={t("live.tower.status.lap")}>
          <span className="uppercase text-[11px] tracking-widest text-(--color-text-dim)">{t("live.tower.status.lap")}</span>
          <span className="font-mono-data tabular text-lg font-bold">{lap.current ?? "—"}</span>
          {lap.total != null && <span className="font-mono-data tabular text-sm text-(--color-text-dim)">/ {lap.total}</span>}
        </div>
      )}
      {!lap.isRace && qPhase != null && isQualifyingSession(session) && (
        <span className="lt-flag-chip" data-kind="phase" title={t("live.tower.phaseFull")}>
          {t("live.tower.phase", { phase: qPhase })}
        </span>
      )}

      <div className="flex items-baseline gap-1.5">
        {!mobile && <span className="uppercase text-[11px] tracking-widest text-(--color-text-dim)">{t("live.tower.status.elapsed")}</span>}
        <span className="font-mono-data tabular text-lg font-bold" aria-label={t("live.tower.status.elapsed")}>
          {formatClock(elapsed, { hours: true })}
        </span>
      </div>

      {chip === "green" && (
        <span className="lt-flag-chip" data-kind="green" title={t("live.tower.status.greenFull")}>
          {t("live.tower.status.green")}
        </span>
      )}
      {chip === "chequered" && (
        <span className="lt-flag-chip" data-kind="chequered" title={t("live.tower.status.chequeredFull")}>
          <i className="lt-chequer" aria-hidden="true" />
          {t("live.tower.status.chequered")}
        </span>
      )}

      <Freshness
        state={fresh}
        compact={mobile}
        details={{ status, speed, clock, lastEventAt, lastBatchAt, epoch }}
        t={t}
      />
    </div>
  );
}

function Freshness({ state, compact, details, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const label = t(`live.tower.fresh.${state}`);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const eventAgo = details.clock != null && details.lastEventAt != null ? Math.max(0, Math.round((details.clock - details.lastEventAt) / 1000)) : null;
  // Час браузера потрібен лише у відкритій панелі деталей (вона перерендерюється з годинником).
  const batchAgo = open && details.lastBatchAt != null ? Math.max(0, Math.round((performance.now() - details.lastBatchAt) / 1000)) : null;

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-(--color-text-dim) hover:text-(--color-text) min-h-6"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        title={`${label}. ${t("live.tower.fresh.details")}`}
      >
        <span className="lt-fresh-dot" data-state={state} aria-hidden="true" />
        <span className={compact ? "lt-sr" : ""} aria-live="polite">
          {label}
        </span>
      </button>
      {open && (
        <div id={id} className="lt-popover" role="dialog" aria-label={t("live.tower.fresh.details")}>
          <p className="uppercase text-[11px] tracking-widest text-(--color-text-dim) mb-1.5">{t("live.tower.fresh.details")}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular">
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.status")}</dt>
            <dd className="m-0">{t(`live.common.status.${details.status}`)}</dd>
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.speed")}</dt>
            <dd className="m-0">×{details.speed}</dd>
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.lastEvent")}</dt>
            <dd className="m-0">{eventAgo == null ? "—" : t("live.tower.fresh.lastEventAgo", { seconds: eventAgo })}</dd>
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.lastBatch")}</dt>
            <dd className="m-0">{batchAgo == null ? "—" : t("live.tower.fresh.lastBatchAgo", { seconds: batchAgo })}</dd>
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.clock")}</dt>
            <dd className="m-0 font-mono-data">{utcTime(details.clock)}</dd>
            <dt className="text-(--color-text-dim)">{t("live.tower.fresh.epoch")}</dt>
            <dd className="m-0">{details.epoch}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
