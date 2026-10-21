import { useRef, useState } from "react";
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
import PredictionExplanation from "../components/analysis/PredictionExplanation";
import { t } from "../i18n";

// Підписи етапів і джерел — у словниках i18n (analysis.stage.*, analysis.source.*).
const STAGE_TONES = { not_started: "neutral", post_quali: "warn", completed: "good" };

function StageBadge({ stage }) {
  if (!STAGE_TONES[stage]) return <Badge tone="neutral">{stage || "—"}</Badge>;
  return <Badge tone={STAGE_TONES[stage]}>{t(`analysis.stage.${stage}`)}</Badge>;
}

function sourceLabel(source) {
  return t(`analysis.source.${source}`, { defaultValue: source });
}

const METRIC_LABELS = {
  mae_test: "MAE",
  top1: "Top-1",
  podium_set: "analysis.metric.podium_set",
  top5_set: "analysis.metric.top5_set",
  top10_set: "analysis.metric.top10_set",
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
      { label: event ? event.EventName : t("chart.roundN", { round }), to: `/${year}/${round}` },
      { label: t("tabs.prediction") },
    ],
    [year, round, event?.EventName]
  );

  // Пілот, для якого показано пояснення; за замовчуванням — переможець прогнозу.
  const [selectedId, setSelectedId] = useState(null);
  const explanationRef = useRef(null);

  const handleRefresh = () => {
    forceRefreshRef.current = true;
    refetch();
  };

  const hasActuals = data?.predictions?.some((p) => p.actual_position != null);

  const columns = [
    { key: "predicted_position", label: t("tabs.prediction") },
    { key: "driver", label: t("standingsTable.driver") },
    { key: "team", label: t("profile.team") },
    { key: "quali_position", label: t("eventCtx.quali") },
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
            label: t("analysis.actual"),
            render: (r) => (
              <span
                className={r.hit ? "text-(--color-good) font-semibold" : "text-(--color-text)"}
                title={r.hit ? t("analysis.hit") : undefined}
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

  const selected = sortedPredictions.find((p) => p.driver_id === selectedId) || sortedPredictions[0];
  const selectDriver = (row) => {
    setSelectedId(row.driver_id);
    // Пояснення — під таблицею: для пілотів унизу таблиці його інакше не видно.
    requestAnimationFrame(() => explanationRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold uppercase">{t("predictionCheck.title")}</h2>
          {data?.generated_at && (
            <p className="text-xs text-(--color-text-dim) font-mono-data">
              {t("analysis.generated", { date: formatDateTime(data.generated_at) })}
              {data.data?.source && ` · ${sourceLabel(data.data.source)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {data?.data?.stage && <StageBadge stage={data.data.stage} />}
          <button
            onClick={handleRefresh}
            disabled={loading}
            title={t("analysis.refreshHint")}
            className="text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors disabled:opacity-40"
          >
            {t("analysis.refresh")}
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={refetch} />

      {loading ? (
        <Loader label={t("analysis.building")} />
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
                {t("analysis.quality")} {data.model?.version && <span className="text-(--color-text-dim)">({data.model.version})</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {curatedMetrics(data.model?.metrics).map(([key, value]) => (
                  <StatTile key={key} label={METRIC_LABELS[key].startsWith("analysis.") ? t(METRIC_LABELS[key]) : METRIC_LABELS[key]} value={formatMetric(value)} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">{t("tabs.prediction")}</h3>
              {sortedPredictions.length > 0 && <p className="text-xs text-(--color-text-dim) mb-2">{t("analysis.clickHint")}</p>}
              <ResultsTable
                rows={sortedPredictions}
                columns={columns}
                emptyLabel={t("analysis.empty")}
                onRowClick={selectDriver}
                isSelected={(row) => row.driver_id === selected?.driver_id}
              />
            </div>

            <div ref={explanationRef} className="scroll-mt-4">
              <PredictionExplanation prediction={selected} predictions={sortedPredictions} />
            </div>

            {(data.feature_importance?.ranker?.length > 0 || data.feature_importance?.dnf_classifier?.length > 0) && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {data.feature_importance?.ranker?.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      {t("analysis.importancePosition")}
                    </h3>
                    <FeatureImportanceChart data={data.feature_importance.ranker} />
                  </div>
                )}
                {data.feature_importance?.dnf_classifier?.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      {t("analysis.importanceDnf")}
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
