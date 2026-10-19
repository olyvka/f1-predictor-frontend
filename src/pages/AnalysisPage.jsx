import { useRef } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { formatDateTime } from "../utils/format";
import ResultsTable from "../components/results/ResultsTable";
import FeatureImportanceChart from "../components/charts/FeatureImportanceChart";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import Badge from "../components/common/Badge";
import StatTile from "../components/common/StatTile";

const STAGE_LABELS = {
  not_started: { label: "До кваліфікації", tone: "neutral" },
  post_quali: { label: "Після кваліфікації", tone: "warn" },
  completed: { label: "Гонка завершена", tone: "good" },
};

const SOURCE_LABELS = {
  static_dataset: "дані з датасету",
  live_fastf1_quali: "живі дані FastF1 (кваліфікація)",
  live_no_quali: "живі дані, без кваліфікації",
};

function StageBadge({ stage }) {
  const meta = STAGE_LABELS[stage] || { label: stage || "—", tone: "neutral" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const METRIC_LABELS = {
  mae_test: "MAE",
  top1: "Top-1",
  podium_set: "Топ-3 (набір)",
  top5_set: "Топ-5 (набір)",
  top10_set: "Топ-10 (набір)",
  spearman_mean: "Spearman",
  ndcg10: "NDCG@10",
  dnf_auc_test: "DNF AUC",
};

// Бекенд віддає й службові поля тренування (train_size, best_alpha_val_mae
// тощо) — "візитка якості моделі" показує лише куровану підмножину, яку
// називає документація, а не все підряд.
function curatedMetrics(metrics) {
  return Object.keys(METRIC_LABELS)
    .filter((key) => metrics?.[key] != null)
    .map((key) => [key, metrics[key]]);
}

function formatMetric(value) {
  if (typeof value !== "number") return String(value ?? "—");
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function dnfTone(p) {
  if (p >= 0.4) return "var(--color-danger)";
  if (p >= 0.15) return "var(--color-warn)";
  return "var(--color-good)";
}

export default function AnalysisPage() {
  const { year, round } = useParams();
  const { event } = useOutletContext();

  // refresh=true б'є в інший запит; тримаємо прапорець у ref, а не в
  // deps useApiQuery — інакше довелось би скидати його вручну без
  // ризику зациклити повторні "примусові" запити на кожен рендер.
  const forceRefreshRef = useRef(false);
  const { data, loading, error, refetch } = useApiQuery(
    () => api.getAnalysis(year, round, forceRefreshRef.current).finally(() => (forceRefreshRef.current = false)),
    [year, round]
  );

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: event ? event.EventName : `Етап ${round}`, to: `/${year}/${round}` },
      { label: "Прогноз" },
    ],
    [year, round, event?.EventName]
  );

  const handleRefresh = () => {
    forceRefreshRef.current = true;
    refetch();
  };

  const hasActuals = data?.predictions?.some((p) => p.actual_position != null);

  const columns = [
    { key: "predicted_position", label: "Прогноз" },
    { key: "driver", label: "Пілот" },
    { key: "team", label: "Команда" },
    { key: "quali_position", label: "Квалі" },
    {
      key: "p_dnf",
      label: "P(DNF)",
      render: (r) =>
        r.p_dnf != null ? (
          <span className="font-semibold" style={{ color: dnfTone(r.p_dnf) }}>
            {Math.round(r.p_dnf * 100)}%
          </span>
        ) : (
          "—"
        ),
    },
    ...(hasActuals
      ? [
          {
            key: "actual_position",
            label: "Факт",
            render: (r) => (
              <span
                className={r.hit ? "text-(--color-good) font-semibold" : "text-(--color-text)"}
                title={r.hit ? "Прогноз збігся" : undefined}
              >
                {r.actual_position ?? "—"}
                {r.hit && " ✓"}
              </span>
            ),
          },
        ]
      : []),
  ];

  const sortedPredictions = [...(data?.predictions || [])].sort(
    (a, b) => (a.predicted_position ?? 999) - (b.predicted_position ?? 999)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold uppercase">Прогноз моделі</h2>
          {data?.generated_at && (
            <p className="text-xs text-(--color-text-dim) font-mono-data">
              Побудовано {formatDateTime(data.generated_at)}
              {data.data?.source && ` · ${SOURCE_LABELS[data.data.source] || data.data.source}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {data?.data?.stage && <StageBadge stage={data.data.stage} />}
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Перебудувати прогноз на сервері з найсвіжішими даними (напр. після кваліфікації). Може тривати кілька хвилин."
            className="text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors disabled:opacity-40"
          >
            Оновити прогноз
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={refetch} />

      {loading ? (
        <Loader label="Будуємо прогноз… перший запит по цьому етапу тренує модель, це може тривати довше за звичне" />
      ) : (
        !error &&
        data && (
          <>
            {data.data?.notes?.length > 0 && (
              <div
                className="border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-3 flex flex-col gap-1"
                style={{ borderLeft: "3px solid var(--color-warn)" }}
              >
                {data.data.notes.map((note, i) => (
                  <p key={i} className="text-sm text-(--color-text-dim)">
                    {note}
                  </p>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                Якість моделі {data.model?.version && <span className="text-(--color-text-dim)">({data.model.version})</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {curatedMetrics(data.model?.metrics).map(([key, value]) => (
                  <StatTile key={key} label={METRIC_LABELS[key]} value={formatMetric(value)} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">Прогноз</h3>
              <ResultsTable rows={sortedPredictions} columns={columns} emptyLabel="Прогнозу немає." />
            </div>

            {(data.feature_importance?.ranker?.length > 0 || data.feature_importance?.dnf_classifier?.length > 0) && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {data.feature_importance?.ranker?.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      Важливість ознак — позиція
                    </h3>
                    <FeatureImportanceChart data={data.feature_importance.ranker} />
                  </div>
                )}
                {data.feature_importance?.dnf_classifier?.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      Важливість ознак — DNF
                    </h3>
                    <FeatureImportanceChart data={data.feature_importance.dnf_classifier} />
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
