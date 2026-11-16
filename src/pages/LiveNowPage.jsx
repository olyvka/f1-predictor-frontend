// Сторінка /live: поточна сесія наживо (платна підписка OpenF1 на бекенді).
//
// Стан береться з GET /api/live/status:
//   live           → той самий екран, що й replay (LiveScreen), з джерелом "live";
//   upcoming       → картка найближчої сесії з таймером до відкриття live-вікна
//                    (OpenF1 віддає дані від 30 хв до старту);
//   none           → у календарі сесій не лишилось;
//   not_configured → на сервері немає облікових даних підписки.
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
    if (!data || data.status === "live") return undefined;
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

  if (status.loading && !data) return <Notice>{t("live.common.now.checking")}</Notice>;
  if (status.error && !data) {
    return (
      <Notice tone="warn" title={t("live.common.now.errorTitle")}>
        <p className="text-sm mb-3">{status.error}</p>
        <button onClick={refetch} className="text-xs uppercase tracking-wide font-semibold text-(--color-accent)">
          {t("live.common.now.retry")}
        </button>
      </Notice>
    );
  }

  if (data.status === "live" && !closed) {
    const cal = data.calendar || {};
    const year = cal.year ?? data.session?.year;
    return (
      <LiveScreen
        key={data.session?.session_key}
        year={year}
        round={cal.round ?? null}
        session={cal.session ?? data.session?.session_name}
        kind="live"
        onWaiting={onWaiting}
      />
    );
  }
  if (data.status === "not_configured") {
    return (
      <Notice tone="warn" title={t("live.common.now.notConfiguredTitle")}>
        <p className="text-sm mb-3">{t("live.common.now.notConfigured")}</p>
        <ReplayHint />
      </Notice>
    );
  }
  if (data.status === "upcoming" && data.session) return <Upcoming data={data} />;
  return (
    <Notice title={t("live.common.now.noneTitle")}>
      <p className="text-sm mb-3">{t("live.common.now.none")}</p>
      <ReplayHint />
    </Notice>
  );
}

function Upcoming({ data }) {
  const { t, i18n } = useTranslation();
  const now = useNow(1000);
  const s = data.session;
  const opens = Date.parse(data.opens_at);
  const start = Date.parse(s.date_start);
  const fmt = new Intl.DateTimeFormat(i18n.language === "uk" ? "uk-UA" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const left = Math.max(0, Math.round((opens - now) / 1000));
  const cal = data.calendar;
  return (
    <div className="max-w-xl mx-auto mt-8 border border-(--color-line) bg-(--color-surface) rounded-md px-5 py-5 flex flex-col gap-3">
      <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-text-dim)">{t("live.common.now.nextTitle")}</p>
      <div>
        <h1 className="text-2xl font-bold uppercase leading-tight">
          {s.country_name} {s.year} · {s.session_name}
        </h1>
        <p className="text-sm text-(--color-text-dim)">
          {s.circuit_short_name} · {t("live.common.now.startsAt", { time: fmt.format(start) })}
        </p>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-semibold tabular">{formatCountdown(left, t("live.common.now.dayShort"))}</span>
        <span className="text-xs text-(--color-text-dim)">{t("live.common.now.opensIn")}</span>
      </div>
      <p className="text-xs text-(--color-text-dim)">{t("live.common.now.windowHint")}</p>
      {cal?.round && (
        <Link to={`/${cal.year}/${cal.round}`} className="self-start text-xs uppercase tracking-wide font-semibold text-(--color-accent)">
          {t("live.common.now.toEvent")} →
        </Link>
      )}
    </div>
  );
}

function ReplayHint() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <Link to={`/${year}`} className="text-xs uppercase tracking-wide font-semibold text-(--color-text-dim) hover:text-(--color-text)">
      {t("live.common.now.toReplays")} →
    </Link>
  );
}

function Notice({ title, tone, children }) {
  return (
    <div
      className="max-w-xl mx-auto mt-8 border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-4"
      style={tone === "warn" ? { borderLeft: "3px solid var(--color-warn)" } : undefined}
    >
      {title && <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-text-dim) mb-1">{title}</p>}
      {typeof children === "string" ? <p className="text-sm">{children}</p> : children}
    </div>
  );
}
