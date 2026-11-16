// Сторінка /live: поточна сесія наживо (платна підписка OpenF1 на бекенді).
//
// Стан береться з GET /api/live/status (календар OpenF1 доступний і без підписки):
//   status "live" + configured → той самий екран, що й replay (LiveScreen), джерело "live";
//   інакше → картка найближчої сесії з таймером до відкриття live-вікна (OpenF1
//            віддає дані від 30 хв до старту); без підписки - з поясненням;
//            "none" → у календарі сесій не лишилось.
// Поки не live - статус перевіряється кожні 30 с і точно в момент відкриття вікна.
// Якщо під час перегляду вікно закрилось, сервер шле "waiting" - повертаємось сюди.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useNow } from "../hooks/useNow";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { formatCountdown } from "../live/format";
import { LiveScreen } from "./LivePage";

const POLL_MS = 30_000;

export default function LiveNowPage() {
  const { t } = useTranslation();
  const status = useApiQuery(() => api.getLiveStatus(), []);
  const { refetch } = status;
  const data = status.data;
  useSetBreadcrumb([{ label: t("live.common.now.title") }], [t]);

  // Поки сесії наживо немає - питаємо знову (і рівно тоді, коли відкриється вікно).
  useEffect(() => {
    if (!data || (data.status === "live" && data.configured)) return undefined;
    const timers = [setInterval(refetch, POLL_MS)];
    const opensIn = data.opens_at ? Date.parse(data.opens_at) - Date.now() : null;
    if (opensIn != null && opensIn > 0 && opensIn < POLL_MS) timers.push(setTimeout(refetch, opensIn + 1000));
    return () => timers.forEach((id) => clearInterval(id));
  }, [data, refetch]);

  // Сервер закрив live-вікно посеред перегляду - знову показуємо статус.
  const [closed, setClosed] = useState(false);
  const onWaiting = useCallback(() => {
    setClosed(true);
    refetch();
  }, [refetch]);
  useEffect(() => {
    if (data?.status === "live") setClosed(false);
  }, [data]);

  if (status.loading && !data) return <Notice standalone>{t("live.common.now.checking")}</Notice>;
  if (status.error && !data) {
    return (
      <Notice standalone tone="warn" title={t("live.common.now.errorTitle")}>
        <p className="text-sm mb-3">{status.error}</p>
        <button onClick={refetch} className="text-xs uppercase tracking-wide font-semibold text-(--color-accent)">
          {t("live.common.now.retry")}
        </button>
      </Notice>
    );
  }

  if (data.status === "live" && data.configured && !closed) {
    const cal = data.calendar || {};
    return (
      <LiveScreen
        key={data.session?.session_key}
        year={cal.year ?? data.session?.year}
        round={cal.round ?? null}
        session={cal.session ?? data.session?.session_name}
        kind="live"
        onWaiting={onWaiting}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_17rem] items-start">
      {data.session ? (
        <NextSession data={data} />
      ) : (
        <Notice title={t("live.common.now.noneTitle")}>{t("live.common.now.none")}</Notice>
      )}
      <TestReplay replay={data.latest_replay} />
    </div>
  );
}

function NextSession({ data }) {
  const { t, i18n } = useTranslation();
  const now = useNow(1000);
  const s = data.session;
  const isLive = data.status === "live";
  const opens = Date.parse(data.opens_at);
  const start = Date.parse(s.date_start);
  const fmt = new Intl.DateTimeFormat(i18n.language === "uk" ? "uk-UA" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const left = Math.max(0, Math.round((opens - now) / 1000));
  const cal = data.calendar;
  return (
    <section className="border border-(--color-line) bg-(--color-surface) rounded-md px-5 py-5 flex flex-col gap-3 min-w-0">
      <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-text-dim)">
        {isLive ? t("live.common.now.liveNow") : t("live.common.now.nextTitle")}
      </p>
      <div>
        <h1 className="text-2xl font-bold uppercase leading-tight">
          {cal?.event || s.country_name} {s.year} · {s.session_name}
        </h1>
        <p className="text-sm text-(--color-text-dim)">
          {s.circuit_short_name} · {t("live.common.now.startsAt", { time: fmt.format(start) })}
        </p>
      </div>
      {!isLive && (
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-4xl font-semibold tabular">{formatCountdown(left, t("live.common.now.dayShort"))}</span>
          <span className="text-xs text-(--color-text-dim)">{t("live.common.now.opensIn")}</span>
        </div>
      )}
      <p className="text-xs text-(--color-text-dim)">
        {data.configured ? t("live.common.now.windowHint") : t("live.common.now.notConfigured")}
      </p>
      {cal?.round && (
        <Link to={`/${cal.year}/${cal.round}`} className="self-start text-xs uppercase tracking-wide font-semibold text-(--color-accent)">
          {t("live.common.now.toEvent")} →
        </Link>
      )}
    </section>
  );
}

// ТИМЧАСОВО (прибрати після перевірки live на справжній сесії): кнопка на
// запис останньої завершеної гонки, щоб показати екран, поки сесії немає.
function TestReplay({ replay }) {
  const { t } = useTranslation();
  if (!replay?.round) return null;
  return (
    <aside className="border border-dashed border-(--color-warn) bg-(--color-surface-2) rounded-md px-4 py-4 flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-(--color-warn)">{t("live.common.now.testTitle")}</p>
      <p className="text-sm">
        {replay.event} {replay.year}
      </p>
      <p className="text-xs text-(--color-text-dim)">{t("live.common.now.testHint")}</p>
      <Link
        to={`/live/${replay.year}/${replay.round}/${replay.session}?speed=2`}
        className="self-start mt-1 inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold px-3 py-2 rounded-md bg-(--color-accent) text-white hover:opacity-90"
      >
        ▶ {t("live.common.now.testButton")}
      </Link>
    </aside>
  );
}

function Notice({ title, tone, standalone = false, children }) {
  return (
    <div
      className={`${standalone ? "mt-8 " : ""}max-w-xl w-full mx-auto border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-4`}
      style={tone === "warn" ? { borderLeft: "3px solid var(--color-warn)" } : undefined}
    >
      {title && <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-text-dim) mb-1">{title}</p>}
      {typeof children === "string" ? <p className="text-sm">{children}</p> : children}
    </div>
  );
}
