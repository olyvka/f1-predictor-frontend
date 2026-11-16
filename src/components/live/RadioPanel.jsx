// Командне радіо (team_radio OpenF1): окремий блок поруч із race control.
//
// - Список кліпів, новіші зверху; ▶ грає кліп в одному спільному <audio>.
// - Статус «прослухано»: кліп позначається, коли дограв до кінця, або вручну
//   кнопкою ●/✓. Стан - у сторі (store.setRadioHeard), сторінка зберігає його в
//   localStorage на сесію, тож переживає перемотування й перезавантаження.
// - Фільтри: усі / пілот у фокусі / непрослухані; «Позначити всі».
// - F1 публікує лише частину переговорів (у 2026 - кілька десятків кліпів за гонку).
// Стилі списку - спільні з race control (raceControl.css), свої - radio.css.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocus, useLiveSelector, useTeamRadio } from "../../live/hooks";
import { formatTrackClock } from "./RaceControlPanel/rc";
import { RADIO_FILTERS, lapAt, matchesRadioFilter, unheardCount } from "./RadioPanel/radio";
import "./RaceControlPanel/raceControl.css";
import "./RadioPanel/radio.css";

const selectMeta = (s) => ({ gmt: s.session?.gmt_offset ?? null, drivers: s.drivers, laps: s.laps });
const metaEqual = (a, b) => a.gmt === b.gmt && a.drivers === b.drivers && a.laps === b.laps;

export default function RadioPanel({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { clips, heard, setHeard } = useTeamRadio();
  const { focus, setFocus } = useFocus();
  const { gmt, drivers, laps } = useLiveSelector(["meta", "table"], selectMeta, metaEqual);
  const [filter, setFilter] = useState("all");

  // Один плеєр на панель: грає щонайбільше один кліп.
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(null); // recording_url
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState({});
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnded = () => {
      if (playing) setHeard(playing, true);
      setPlaying(null);
      setProgress(0);
    };
    const onError = () => {
      if (playing) setFailed((f) => ({ ...f, [playing]: true }));
      setPlaying(null);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [playing, setHeard]);

  const toggle = (url) => {
    const a = audioRef.current;
    if (!a) return;
    if (playing === url) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = url;
    setProgress(0);
    setPlaying(url);
    a.play().catch(() => {
      setFailed((f) => ({ ...f, [url]: true }));
      setPlaying(null);
    });
  };

  const newestFirst = useMemo(() => [...clips].reverse(), [clips]);
  const shown = newestFirst.filter((c) => matchesRadioFilter(c, filter, { focus, heard }));
  const unheard = unheardCount(clips, heard);

  return (
    <section className="lev-panel lrd-panel" data-layout={layout} aria-label={t("live.radio.title")}>
      <header className="lev-head">
        <h3 className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
          {t("live.radio.title")}
          {unheard > 0 && (
            <span className="lrd-badge tabular" title={t("live.radio.unheardHint", { count: unheard })}>
              {unheard}
            </span>
          )}
        </h3>
        <div className="lev-filters" role="group" aria-label={t("live.radio.filtersLabel")}>
          {RADIO_FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t(`live.radio.filter.${f}`)}
            </button>
          ))}
        </div>
        {unheard > 0 && (
          <button type="button" className="lrd-markall" onClick={() => setHeard(clips.map((c) => c.recording_url), true)}>
            {t("live.radio.markAll")}
          </button>
        )}
      </header>

      <ul className="lev-list">
        {shown.length === 0 ? (
          <li className="lev-empty">
            {!clips.length ? t("live.radio.empty") : filter === "focus" && focus == null ? t("live.radio.pickDriver") : t(`live.radio.emptyFilter.${filter}`)}
          </li>
        ) : (
          shown.map((c) => {
            const d = drivers[c.driver_number];
            const isHeard = !!heard[c.recording_url];
            const isPlaying = playing === c.recording_url;
            const lap = lapAt(laps, c.driver_number, c.t);
            return (
              <li key={c.recording_url} className="lrd-item" data-heard={isHeard} data-mine={c.driver_number === focus && focus != null}>
                <button
                  type="button"
                  className="lrd-play"
                  data-playing={isPlaying}
                  onClick={() => toggle(c.recording_url)}
                  aria-label={isPlaying ? t("live.radio.pause") : t("live.radio.play", { driver: d?.acronym ?? c.driver_number })}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <div className="lrd-body">
                  <span className="lev-meta tabular">
                    {d ? (
                      <button type="button" className="lev-tla lrd-tla" onClick={() => setFocus(c.driver_number)} title={d.full_name || undefined}>
                        <i style={{ background: d.color }} />
                        {d.acronym}
                      </button>
                    ) : (
                      <span className="lev-tla">#{c.driver_number}</span>
                    )}
                    {lap != null && <span>{t("live.radio.lap", { lap })}</span>}
                    <span>{formatTrackClock(c.t, gmt)}</span>
                  </span>
                  {isPlaying ? (
                    <span className="lrd-progress" aria-hidden="true">
                      <span style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  ) : failed[c.recording_url] ? (
                    <span className="lrd-failed">{t("live.radio.failed")}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="lrd-heard"
                  data-heard={isHeard}
                  onClick={() => setHeard(c.recording_url, !isHeard)}
                  title={isHeard ? t("live.radio.markUnheard") : t("live.radio.markHeard")}
                  aria-label={isHeard ? t("live.radio.heard") : t("live.radio.unheard")}
                >
                  {isHeard ? "✓" : "●"}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="lrd-note">{t("live.radio.coverage")}</p>
    </section>
  );
}
