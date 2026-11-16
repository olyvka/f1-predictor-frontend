// Стрічка race control (E у LIVE_UI_RESEARCH §3; на телефоні - вкладка «Події»).
// Завдання: L9 (стрічка, мітка за flag, фільтри). Дизайн: W7 (текст FIA не
// перекладаємо), кольори прапорів §5.3, рух §5.8, W16 (тости). Власник: агент D.
//
// Пропси: layout: "mobile" | "tablet" | "desktop" | "wide".
// Чисті функції (час траси з gmt_offset, фільтри, чіпи) - RaceControlPanel/rc.js.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRaceControl, useSession, useFocus, useLiveSelector } from "../../live/hooks";
import { formatLapTime } from "../../live/format";
import { RC_FILTERS, matchesFilter, countByFilter, flagMeta, messageKeys, mentionsDriver, trackClock } from "./RaceControlPanel/rc";
import { useToasts } from "./RaceControlPanel/useToasts";
import "./RaceControlPanel/raceControl.css";

const selectEpoch = (s) => s.playback.epoch;
const SCROLLED_PX = 8;

function FlagChip({ msg, t }) {
  const { kind, raw } = flagMeta(msg);
  const label = raw ?? t(`live.events.flag.${kind}`);
  let icon = null;
  if (kind === "yellow" || kind === "green" || kind === "clear" || kind === "red" || kind === "blue")
    icon = (
      <span className="ico" aria-hidden="true">
        <b />
      </span>
    );
  else if (kind === "double-yellow")
    icon = (
      <span className="ico" aria-hidden="true">
        <b />
        <b />
      </span>
    );
  else if (kind === "chequered" || kind === "bw" || kind === "black-orange") icon = <span className="sw" aria-hidden="true" />;
  return (
    <span className="lev-flag" data-kind={kind} title={msg.flag || msg.category || undefined}>
      {icon}
      {label}
    </span>
  );
}

export default function RaceControlPanel({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { messages } = useRaceControl();
  const { session, drivers } = useSession();
  const { focus } = useFocus();
  const epoch = useLiveSelector("playback", selectEpoch);
  const [filter, setFilter] = useState("all");
  const gmt = session?.gmt_offset;

  const keys = useMemo(() => messageKeys(messages), [messages]);
  const counts = useMemo(() => countByFilter(messages), [messages]);
  const visible = useMemo(() => {
    const out = [];
    messages.forEach((m, i) => {
      if (matchesFilter(m, filter)) out.push({ m, key: keys[i] });
    });
    return out;
  }, [messages, keys, filter]);

  // Нові повідомлення (не з catch-up/перемотування) - анімація появи.
  // seen: ключ → коли вперше побачили; на новому epoch усе поточне - «старе».
  const seen = useRef({ epoch: null, at: new Map() });
  const nowMs = performance.now();
  const s = seen.current;
  if (s.epoch !== epoch) {
    s.epoch = epoch;
    s.at = new Map(keys.map((k) => [k, -Infinity]));
  }
  for (const k of keys) if (!s.at.has(k)) s.at.set(k, nowMs);
  const isNew = (k) => nowMs - (s.at.get(k) ?? -Infinity) < 400;

  // Прокрутка: якщо користувач проскролив вниз - тримаємо його місце і
  // показуємо «↑ N нових» замість автоскролу.
  const listRef = useRef(null);
  const prevRef = useRef({ height: 0, first: null, epoch, filter });
  const [unseen, setUnseen] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const prev = prevRef.current;
    const first = visible[0]?.key ?? null;
    if (prev.epoch !== epoch || prev.filter !== filter) {
      el.scrollTop = 0;
      setUnseen(0);
    } else if (first !== prev.first && el.scrollTop > SCROLLED_PX) {
      let added = 0;
      for (const v of visible) {
        if (v.key === prev.first) break;
        added++;
      }
      el.scrollTop += el.scrollHeight - prev.height;
      if (added) setUnseen((n) => n + added);
    }
    prevRef.current = { height: el.scrollHeight, first, epoch, filter };
  }, [visible, epoch, filter]);
  const onScroll = (e) => {
    if (e.currentTarget.scrollTop <= SCROLLED_PX && unseen) setUnseen(0);
  };
  const toTop = () => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setUnseen(0);
  };

  const toast = useToasts();
  const timeTitle = trackClock(0, gmt)?.utc ? t("live.events.utcHint") : t("live.events.localHint");

  return (
    <section className="lev-panel" data-layout={layout} aria-label={t("live.events.title")}>
      <header className="lev-head">
        <h3 className="text-xs font-bold uppercase tracking-wide">{t("live.events.title")}</h3>
        <div className="lev-filters" role="group" aria-label={t("live.events.filtersLabel")}>
          {RC_FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`live.events.filters.${f}`)}
              {f !== "all" && counts[f] > 0 && <small className="tabular">{counts[f]}</small>}
            </button>
          ))}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 flex flex-col">
        {unseen > 0 && (
          <button type="button" className="lev-newchip" style={{ top: 8 }} onClick={toTop}>
            {t("live.events.newMessages", { count: unseen })}
          </button>
        )}

        <ul ref={listRef} className="lev-list" onScroll={onScroll} aria-live="polite" aria-relevant="additions">
          {visible.length === 0 && (
            <li className="lev-empty">{!messages.length || filter === "all" ? t("live.events.empty") : t(`live.events.emptyFilter.${filter}`)}</li>
          )}
          {visible.map(({ m, key }) => {
            const d = m.driver_number != null ? drivers[m.driver_number] : null;
            const mine = focus != null && mentionsDriver(m, focus);
            const time = trackClock(m.t, gmt);
            return (
              <li key={key} className="lev-item" data-new={isNew(key)} data-mine={mine} title={mine ? t("live.events.focusHint") : undefined}>
                <FlagChip msg={m} t={t} />
                <span className="lev-meta tabular">
                  {m.lap_number != null && <span>{t("live.events.lap", { lap: m.lap_number })}</span>}
                  {m.lap_number != null && time && <span aria-hidden="true">·</span>}
                  {time && (
                    <span title={timeTitle}>
                      {time.text}
                      {time.utc && " UTC"}
                    </span>
                  )}
                  {d && (
                    <span className="lev-tla" title={d.full_name || d.broadcast_name || undefined}>
                      <i style={{ background: d.color }} aria-hidden="true" />
                      {d.acronym}
                    </span>
                  )}
                </span>
                <span className="lev-msg" lang="en">
                  {m.message}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {toast && <Toast key={toast.id} toast={toast} drivers={drivers} t={t} />}
    </section>
  );
}

function Toast({ toast, drivers, t }) {
  const d = drivers[toast.driverNumber];
  const tla = d?.acronym ?? String(toast.driverNumber);
  const sec = (v) => (typeof v === "number" && Number.isFinite(v) ? t("live.events.toast.seconds", { value: v.toFixed(1) }) : "—");
  let text;
  if (toast.kind === "pit") {
    text = t("live.events.toast.pit", { tla, lane: sec(toast.pit.lane_duration ?? toast.pit.pit_duration) });
    if (toast.pit.stop_duration != null) text += ` · ${t("live.events.toast.pitStop", { stop: sec(toast.pit.stop_duration) })}`;
  } else {
    text = `⏱ ${t("live.events.toast.fastest", { tla, time: formatLapTime(toast.time) })}`;
  }
  return (
    <div className="lev-toast tabular" data-kind={toast.kind} role="status">
      {d && <i className="inline-block w-[3px] h-[11px] rounded-sm mr-1.5 align-[-1px]" style={{ background: d.color }} aria-hidden="true" />}
      {text}
    </div>
  );
}
