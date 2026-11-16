// Екран Live / Replay: /live/:year/:round/:session?speed=&offset=&source=
// (L4, L14, LIVE_UI_RESEARCH §3). Сторінка - каркас фундаменту: створює стор і
// джерело, розкладає віджети по слотах і показує базові стани. Віджети живуть у
// src/components/live/ (кожен - свій власник), дані - src/live/ (README).
//
// Query:
//   speed   - швидкість replay (0.25-20), за замовчуванням 1;
//   offset  - секунди від запланованого старту сесії, за замовчуванням 0;
//             оновлюється в адресі під час перегляду, тож посилання відкриває той самий момент;
//   source  - "fixture" → офлайн-фікстура без бекенду (dev); fixture=<назва>, drop=<с> - імітація обриву.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { createLiveStore } from "../live/store";
import { createLiveSource } from "../live/createSource";
import LiveProvider from "../live/LiveProvider";
import { useLiveSelector } from "../live/hooks";
import { useLiveLayout } from "../live/useLiveLayout";
import { roundOffset } from "../live/sources/url";
import StatusBar from "../components/live/StatusBar";
import WeatherChips from "../components/live/WeatherChips";
import TrackStatusBanner from "../components/live/TrackStatusBanner";
import TimingTower from "../components/live/TimingTower";
import TrackMap from "../components/live/TrackMap";
import FocusPanel from "../components/live/FocusPanel";
import RaceControlPanel from "../components/live/RaceControlPanel";
import ReplayControls from "../components/live/ReplayControls";
import ConnectionOverlay from "../components/live/ConnectionOverlay";
import { isReplayYear } from "../live/availability";
import "../live/layout.css";

// Палітра для дальтоніків (.live-cb, токени в src/index.css): вибір глядача,
// пам'ятаємо в localStorage (може бути недоступний - тоді просто вимкнено).
const CB_KEY = "live.colorBlind";
function useColorBlind() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(CB_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOn((v) => {
      try {
        localStorage.setItem(CB_KEY, v ? "0" : "1");
      } catch {
        /* немає доступу до сховища */
      }
      return !v;
    });
  return [on, toggle];
}

const num = (v, fallback) => {
  const x = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export default function LivePage() {
  const { year, round, session } = useParams();
  const { t } = useTranslation();
  const y = Number(year);
  const r = Number(round);
  const supported = isReplayYear(y) && Number.isInteger(r) && r > 0;

  const races = useApiQuery(() => api.getRaces(y), [y], { enabled: Number.isInteger(y) });
  const eventName = races.data?.find((e) => e.RoundNumber === r)?.EventName;
  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: eventName || t("chart.roundN", { round }), to: `/${year}/${round}` },
      { label: session, to: `/${year}/${round}/${session}` },
      { label: t("live.common.pageTitle") },
    ],
    [year, round, session, eventName, t]
  );

  if (!supported) {
    return (
      <div className="max-w-xl mx-auto mt-8 border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-4" style={{ borderLeft: "3px solid var(--color-warn)" }}>
        <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-warn) mb-1">{t("live.common.unsupportedYearTitle")}</p>
        <p className="text-sm mb-3">{t("live.common.unsupportedYear", { year })}</p>
        <Link to={`/${year}/${round}/${session}`} className="text-xs uppercase tracking-wide font-semibold text-(--color-text-dim) hover:text-(--color-text)">
          ← {t("live.common.backToSession")}
        </Link>
      </div>
    );
  }
  // key: інша сесія → новий стор і з'єднання.
  return <LiveScreen key={`${y}/${r}/${session}`} year={y} round={r} session={session} />;
}

// kind "live" передає сторінка /live (LiveNowPage); інакше - replay або фікстура з адреси.
export function LiveScreen({ year, round, session, kind: kindProp, onWaiting }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = kindProp || (searchParams.get("source") === "fixture" ? "fixture" : "backend");
  const fixtureName = searchParams.get("fixture") || undefined;
  // speed/offset/drop читаються один раз: далі адреса лише відображає поточний момент.
  const [initial] = useState(() => ({
    speed: num(searchParams.get("speed"), 1),
    offset: num(searchParams.get("offset"), 0),
    drop: num(searchParams.get("drop"), null),
  }));
  const [store] = useState(() => createLiveStore());
  const [source, setSource] = useState(null);
  const lang = i18n.language;

  useEffect(() => {
    let cancelled = false;
    let src = null;
    createLiveSource({
      store,
      kind,
      fixtureName,
      year,
      round,
      session,
      speed: initial.speed,
      offset: initial.offset,
      lang,
      dropAfterSeconds: initial.drop,
      onWaiting,
    })
      .then((s) => {
        if (cancelled) return;
        src = s;
        s.start();
        setSource(s);
        if (import.meta.env.DEV) window.__live = { store, source: s }; // налагодження з консолі
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.message === "fixtures-disabled" ? t("live.common.fixturesDisabled") : String(e?.message || e);
        store.setConnection({ status: "error", error: msg });
      });
    return () => {
      cancelled = true;
      src?.close();
    };
    // t не в залежностях: зміна мови перемонтовує весь <main> (App.jsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, kind, fixtureName, year, round, session, initial, lang]);

  useReplayUrlSync(store, setSearchParams);

  const params = useMemo(() => ({ year, round, session, sourceKind: kind }), [year, round, session, kind]);
  return (
    <LiveProvider store={store} source={source} params={params}>
      <LiveLayout fixture={kind === "fixture"} />
    </LiveProvider>
  );
}

// Адреса відображає поточний момент (offset, speed), щоб посилання відкривало
// replay з того ж місця (L4). Пишемо рідко (replace, без нового запису історії).
function useReplayUrlSync(store, setSearchParams) {
  const last = useRef({ offset: null, speed: null, paused: null });
  useEffect(() => {
    const id = setInterval(() => {
      const s = store.getState();
      const p = s.playback;
      if (s.sessionStart == null || p.seeking || p.mode === "live" || !["playing", "paused", "buffering", "ended"].includes(p.status)) return;
      const clock = store.getClockLocal();
      if (clock == null) return;
      const offset = Math.round(roundOffset((clock - s.sessionStart) / 1000));
      const prev = last.current;
      const moved = prev.offset == null || Math.abs(offset - prev.offset) >= 15 || (p.paused && offset !== prev.offset);
      if (!moved && prev.speed === p.speed && prev.paused === p.paused) return;
      last.current = { offset, speed: p.speed, paused: p.paused };
      setSearchParams(
        (cur) => {
          const next = new URLSearchParams(cur);
          next.set("offset", String(offset));
          next.set("speed", String(p.speed));
          return next;
        },
        { replace: true, preventScrollReset: true }
      );
    }, 2000);
    return () => clearInterval(id);
  }, [store, setSearchParams]);
}

const PANELS = ["positions", "map", "driver", "events"];

function LiveLayout({ fixture }) {
  const { t } = useTranslation();
  const layout = useLiveLayout();
  const seeking = useLiveSelector("playback", (s) => !!s.playback.seeking);
  // Вкладка на телефоні (усі 4) і на планшеті (Пілот/Події під картою).
  const [panel, setPanel] = useState("positions");
  const topRef = useRef(null);
  const [colorBlind, toggleColorBlind] = useColorBlind();
  const controlsRef = useRef(null);

  // Висоти верхнього бару застосунку, липкої шапки екрана і панелі керування -
  // для липких зон і плаваючих чіпів на телефоні (CSS-змінні в src/live/layout.css).
  useEffect(() => {
    const el = topRef.current;
    const screen = el?.closest(".live-screen");
    const appBar = document.querySelector("body header");
    const controls = controlsRef.current;
    if (!el || !screen || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      screen.style.setProperty("--live-top-h", `${el.offsetHeight}px`);
      if (appBar) screen.style.setProperty("--live-topbar-h", `${appBar.offsetHeight}px`);
      if (controls) screen.style.setProperty("--live-controls-h", `${controls.offsetHeight}px`);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (appBar) ro.observe(appBar);
    if (controls) ro.observe(controls);
    return () => ro.disconnect();
  }, []);

  const tabButton = (id, { side = false } = {}) => {
    // На планшеті «Пілот» активний для будь-якої вкладки, крім «Події».
    const active = side && id === "driver" ? panel !== "events" : panel === id;
    return (
      <button
        key={id}
        role="tab"
        aria-selected={active}
        onClick={() => setPanel(id)}
        className={`flex-1 px-3 text-xs uppercase tracking-wide rounded transition-colors ${side ? "py-1" : "py-2 min-h-11"} ${
          active ? "bg-(--color-accent) text-white font-semibold" : "text-(--color-text-dim) hover:text-(--color-text)"
        }`}
      >
        {t(`live.common.tabs.${id}`)}
      </button>
    );
  };

  return (
    <div className={`live-screen${colorBlind ? " live-cb" : ""}`}>
      <div className="live-grid" data-seeking={seeking}>
        <div ref={topRef} className="live-area-top flex flex-col gap-2">
          <div className="flex flex-wrap items-stretch gap-2">
            {/* На вузькому екрані статус-бар займає весь рядок, погода - під ним. */}
            <div className="min-w-0 flex-[1_1_22rem]">
              <StatusBar layout={layout} />
            </div>
            <WeatherChips layout={layout} />
            <button
              type="button"
              onClick={toggleColorBlind}
              aria-pressed={colorBlind}
              title={t("live.common.colorBlindHint")}
              className={`self-center shrink-0 text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded border transition-colors ${
                colorBlind ? "border-(--color-accent) text-(--color-text) bg-(--color-surface-2)" : "border-(--color-line) text-(--color-text-dim) hover:text-(--color-text)"
              }`}
            >
              <span aria-hidden="true">◐ </span>
              {t("live.common.colorBlind")}
            </button>
            {fixture && (
              <span className="self-center text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded border border-(--color-warn) text-(--color-warn)">
                {t("live.common.fixtureMode")}
              </span>
            )}
          </div>
          <TrackStatusBanner layout={layout} />
        </div>

        <nav className="live-area-tabs md:hidden flex gap-1 bg-(--color-surface) border border-(--color-line) rounded-md p-1" role="tablist" aria-label={t("live.common.tabs.label")}>
          {PANELS.map((id) => tabButton(id))}
        </nav>

        <div className={`live-area-tower ${panel !== "positions" ? "max-md:hidden" : ""}`} role="tabpanel">
          <TimingTower layout={layout} />
        </div>
        <div className={`live-area-map ${panel !== "map" ? "max-md:hidden" : ""}`} role="tabpanel">
          <TrackMap layout={layout} />
        </div>
        <div className={`live-area-side ${panel !== "driver" && panel !== "events" ? "max-md:hidden" : ""}`}>
          <nav className="hidden md:flex xl:hidden gap-1 bg-(--color-surface) border border-(--color-line) rounded-md p-1" role="tablist" aria-label={t("live.common.tabs.label")}>
            {tabButton("driver", { side: true })}
            {tabButton("events", { side: true })}
          </nav>
          <div className={`live-panel ${panel === "events" ? "max-xl:hidden" : ""}`} role="tabpanel">
            <FocusPanel layout={layout} />
          </div>
          <div className={`live-panel ${panel !== "events" ? "max-xl:hidden" : ""}`} role="tabpanel">
            <RaceControlPanel layout={layout} />
          </div>
        </div>

        <div ref={controlsRef} className="live-area-controls">
          <ReplayControls layout={layout} />
        </div>
      </div>
      <ConnectionOverlay layout={layout} />
    </div>
  );
}
