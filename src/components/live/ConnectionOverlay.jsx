// Оверлеї стану з'єднання поверх сітки екрана Live.
// Завдання: L14 (стани: завантаження 3-8 с, error + «Спробувати ще», end +
// підсумок і посилання на результати, lost/перепідключення, перемотування).
// Дизайн: LIVE_UI_RESEARCH W15, «Загальні правила станів» у §4. Власник: агент D.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
//
// Зараз - БАЗОВА робоча версія від фундаменту (усі стани функціональні, вигляд
// простий). Агент D її полірує: skeleton, «Довше, ніж зазвичай» + «Скасувати»,
// фінальна таблиця на end тощо. Сторінка рендерить компонент усередині
// `relative`-контейнера сітки: шар absolute inset-0, кліки проходять крізь нього.
// Під час playback.seeking сторінка сама приглушує сітку (opacity) - тут лише напис.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReplay, useSession, useLiveParams } from "../../live/hooks";
import { useElapsed } from "../../hooks/useElapsed";

function Card({ tone = "accent", children }) {
  return (
    <div
      className="pointer-events-auto max-w-md w-full border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-3 shadow-lg"
      style={{ borderLeft: `3px solid var(--color-${tone})` }}
    >
      {children}
    </div>
  );
}

function useCountdown(retryAt) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (retryAt == null) {
      setLeft(null);
      return;
    }
    const read = () => setLeft(Math.max(0, Math.ceil((retryAt - performance.now()) / 1000)));
    read();
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, [retryAt]);
  return left;
}

export default function ConnectionOverlay({ layout = "desktop" }) {
  const { t } = useTranslation();
  const r = useReplay();
  const { ready } = useSession();
  const { year, round, session } = useLiveParams();
  const loading = !ready && ["idle", "connecting", "loading"].includes(r.status);
  const elapsed = useElapsed(loading);
  const left = useCountdown(r.status === "lost" ? r.reconnect?.retryAt ?? null : null);

  let content = null;
  let place = "center";
  if (r.status === "error") {
    content = (
      <Card tone="danger">
        <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-danger) mb-1">{t("live.common.errorTitle")}</p>
        {r.error && <p className="text-sm mb-3">{r.error}</p>}
        <button onClick={r.retry} className="text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md bg-(--color-accent) text-white">
          {t("live.common.retry")}
        </button>
      </Card>
    );
  } else if (loading) {
    content = (
      <Card>
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 shrink-0 rounded-full border-2 border-(--color-line) border-t-(--color-accent) animate-spin" aria-hidden="true" />
          <div>
            <p className="text-sm">{t("live.common.loadingSession")}</p>
            <p className="text-xs text-(--color-text-dim) tabular">
              {t("live.common.loadingHint")} · {t("units.seconds", { value: elapsed })}
            </p>
            {elapsed >= 15 && <p className="text-xs text-(--color-text-dim) mt-1">{t("live.common.loadingLong")}</p>}
          </div>
        </div>
      </Card>
    );
  } else if (r.seeking) {
    content = (
      <Card>
        <p className="text-sm">{t("live.common.seeking")}</p>
      </Card>
    );
  } else if (r.status === "lost") {
    place = "top";
    content = (
      <Card tone="warn">
        <p className="text-sm">
          {t("live.common.lost")} {left != null && left > 0 ? t("live.common.reconnectIn", { seconds: left }) : t("live.common.reconnecting")}
        </p>
        <button onClick={r.retry} className="mt-2 text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md border border-(--color-line)">
          {t("live.common.reconnectNow")}
        </button>
      </Card>
    );
  } else if (r.status === "ended") {
    place = "top";
    content = (
      <Card tone="good">
        <p className="text-sm font-semibold">{t("live.common.ended")}</p>
        <Link to={`/${year}/${round}/${session}`} className="text-xs underline text-(--color-text-dim)">
          {t("live.common.openResults")}
        </Link>
      </Card>
    );
  }
  if (!content) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex justify-center p-4 ${place === "top" ? "items-start" : "items-center"}`}
      role={r.status === "error" ? "alert" : "status"}
      aria-live="polite"
      data-layout={layout}
    >
      {content}
    </div>
  );
}
