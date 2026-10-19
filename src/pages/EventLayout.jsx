import { Suspense } from "react";
import { Outlet, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import SessionTabs from "../components/event/SessionTabs";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import Badge from "../components/common/Badge";
import { formatDateTime } from "../utils/format";

// Один запит на /api/races/{year} (щоб дістати назву/дату/EventFormat етапу
// за номером) і /api/sessions/{year}/{round} (для табів) — обидва доступні
// дочірнім сторінкам через Outlet context, щоб не дублювати запити нижче.
export default function EventLayout() {
  const { year, round } = useParams();
  const numericYear = Number(year);
  const numericRound = Number(round);

  const races = useApiQuery(() => api.getRaces(numericYear), [numericYear]);
  const sessions = useApiQuery(() => api.getSessions(numericYear, numericRound), [
    numericYear,
    numericRound,
  ]);

  const event = races.data?.find((r) => r.RoundNumber === numericRound);
  const error = races.error || sessions.error;
  const retry = () => {
    races.refetch();
    sessions.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold uppercase">
            {event ? event.EventName : `Етап ${round}`}
          </h2>
          {event?.EventFormat === "sprint_qualifying" && <Badge tone="sprint">Спринт</Badge>}
        </div>
        {event && (
          <p className="text-xs text-(--color-text-dim) font-mono-data">
            {event.Location}, {event.Country} · {formatDateTime(event.EventDate)}
          </p>
        )}
      </div>

      <ErrorBanner message={error} onRetry={retry} />

      {sessions.loading ? (
        <Loader label={`Завантажуємо список сесій етапу ${round}…`} />
      ) : (
        !sessions.error && <SessionTabs sessions={sessions.data || []} />
      )}

      {/* Дочірні сторінки вантажаться ліниво (див. App.jsx) — свій Suspense
          тут, щоб на час підвантаження чанка шапка й таби етапу лишались. */}
      <Suspense fallback={<Loader label="Завантажуємо сторінку…" />}>
        <Outlet context={{ event, sessions: sessions.data || [] }} />
      </Suspense>
    </div>
  );
}
