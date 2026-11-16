// «Модель vs гонка» (W13, L12, LIVE_UI_RESEARCH §7.1): прогноз пілота до старту
// (P, Δ до поточного місця зі стрілкою, ризик сходу), «Чому модель ставила його
// на Pn» (SHAP-фактори, як на сторінці аналізу), і плитка точності моделі зараз:
// Спірмен прогнозного й поточного порядку, «подіум N з 3», точні місця.
// Чесно: «прогноз до старту, під час гонки не оновлюється», data.notes - у
// підказці, бейдж data.stage.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTower } from "../../../live/hooks";
import { modelVsRace } from "../../../live/predictions";
import Badge from "../../common/Badge";
import { modelPairs, percent, positionDelta, signedImpact, topFactors } from "./helpers";

// Бейдж каже, на чому побудовано прогноз, а не стан гонки: data.stage = "completed"
// під час replay читався б як «гонка завершена» посеред гонки.
const BASIS_TONES = { quali: "good", noQuali: "warn" };

// Смужка від центру: вправо (зелена) - тягне до P1, вліво (червона) - вниз.
// Та сама подача, що й у PredictionExplanation на сторінці аналізу.
function DivergingBar({ value, max }) {
  const width = max > 0 ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
  const positive = value >= 0;
  return (
    <div className="relative h-2 rounded-full bg-(--color-line)" aria-hidden="true">
      <span className="absolute inset-y-0 left-1/2 w-px bg-(--color-text-dim)/60" />
      <span
        className="absolute inset-y-0 rounded-full"
        style={{ width: `${width}%`, left: positive ? "50%" : `${50 - width}%`, background: positive ? "var(--color-good)" : "var(--color-danger)" }}
      />
    </div>
  );
}

function FactorRow({ label, impact, max }) {
  const tone = impact > 0.05 ? "var(--color-good)" : impact < -0.05 ? "var(--color-danger)" : "var(--color-text-dim)";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2 text-xs">
      <span className="truncate" title={label}>
        {label}
      </span>
      <DivergingBar value={impact} max={max} />
      <span className="tabular text-right font-semibold" style={{ color: tone }}>
        {signedImpact(impact)}
      </span>
    </li>
  );
}

function Tile({ value, label, sub, title }) {
  return (
    <div className="rounded-md bg-(--color-surface-2) border border-(--color-line) px-2 py-1.5 min-w-0" title={title}>
      <div className="tabular text-[17px] font-bold leading-tight">{value}</div>
      <div className="text-[10px] leading-tight text-(--color-text-dim)">{label}</div>
      {sub && <div className="text-[10px] leading-tight text-(--color-text-dim) mt-0.5">{sub}</div>}
    </div>
  );
}

function Skeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-md bg-(--color-surface-2) animate-pulse" />
        ))}
      </div>
      <p className="text-xs text-(--color-text-dim)" title={t("live.focus.model.loadingHint")}>
        {t("live.focus.model.loading")}
      </p>
    </div>
  );
}

function DriverPrediction({ prediction, driver, position, gone }) {
  const { t } = useTranslation();
  if (!prediction) {
    return (
      <p className="text-xs text-(--color-text-dim)">
        <span className="font-bold text-(--color-text) mr-1">—</span>
        {t("live.focus.model.noPrediction")}
      </p>
    );
  }
  const predicted = prediction.predicted_position;
  const delta = gone ? null : positionDelta(predicted, position);
  const dnf = percent(prediction.p_dnf);
  const top = topFactors(prediction.explanation, 5);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="text-(--color-text-dim)">{t("live.focus.model.predicted", { driver: driver?.acronym ?? prediction.driver })}</span>
        <span className="tabular text-[17px] font-bold">P{predicted}</span>
        {position != null && !gone && <span className="tabular text-(--color-text-dim)">{t("live.focus.model.now", { position })}</span>}
        {delta != null && (
          <span
            className="tabular font-semibold"
            style={{ color: delta > 0 ? "var(--color-good)" : delta < 0 ? "var(--color-danger)" : "var(--color-text-dim)" }}
          >
            {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "="}{" "}
            <span className="font-normal">
              {delta > 0 ? t("live.focus.model.better") : delta < 0 ? t("live.focus.model.worse") : t("live.focus.model.same")}
            </span>
          </span>
        )}
        {dnf != null && (
          <span className={gone ? "font-semibold" : "text-(--color-text-dim)"}>
            · {gone ? t("live.focus.model.dnfGone", { value: dnf }) : t("live.focus.model.dnf", { value: dnf })}
          </span>
        )}
      </div>
      {top ? (
        <div className="flex flex-col gap-1.5">
          <h5 className="text-[11px] text-(--color-text-dim)" title={t("live.focus.model.whyHint")}>
            {t("live.focus.model.why", { position: predicted })} <span aria-hidden="true">ⓘ</span>
          </h5>
          <ul className="flex flex-col gap-1.5">
            {top.factors.map((f) => (
              <FactorRow key={f.feature} label={f.label || f.feature} impact={f.impact} max={top.max} />
            ))}
            <FactorRow label={t("explain.other")} impact={top.other} max={top.max} />
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-(--color-text-dim)">{t("live.focus.model.noExplanation")}</p>
      )}
    </div>
  );
}

export default function ModelVsRace({ pred, number, driver, position, gone }) {
  const { t } = useTranslation();
  const { rows } = useTower();
  const analysis = pred.analysis;
  const stage = analysis?.data?.stage;
  const basis = analysis?.data ? (analysis.data.quali_available ? "quali" : "noQuali") : null;
  const notes = analysis?.data?.notes || [];
  const usual = analysis?.model?.metrics?.spearman_mean;
  const tile = useMemo(() => (pred.status === "ready" ? modelVsRace(modelPairs(rows, pred.byNumber)) : null), [pred.status, pred.byNumber, rows]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-dim)">{t("live.focus.model.title")}</h4>
        <span className="flex items-center gap-1.5">
          {notes.length > 0 && (
            <span
              tabIndex={0}
              className="text-xs text-(--color-text-dim) cursor-help"
              title={`${t("live.focus.model.notes")}:\n${notes.map((n) => `• ${n}`).join("\n")}`}
              aria-label={`${t("live.focus.model.notes")}: ${notes.join(" ")}`}
            >
              ⓘ
            </span>
          )}
          {basis && (
            <span title={stage ? t("live.focus.model.stageHint", { stage: t(`analysis.stage.${stage}`, { defaultValue: stage }) }) : undefined}>
              <Badge tone={BASIS_TONES[basis]}>{t(`live.focus.model.basis.${basis}`)}</Badge>
            </span>
          )}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-(--color-text-dim)">{t("live.focus.model.honest")}</p>

      {pred.status === "error" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-(--color-warn)">{t("live.focus.model.error", { error: pred.error })}</p>
          <button
            type="button"
            onClick={pred.refetch}
            className="rounded-md border border-(--color-line) px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide hover:bg-(--color-surface-hover)"
          >
            {t("live.focus.model.retry")}
          </button>
        </div>
      ) : pred.status !== "ready" ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Tile
              value={tile?.rho == null ? "—" : tile.rho.toFixed(2)}
              label={t("live.focus.model.spearman")}
              sub={usual != null ? t("live.focus.model.usually", { value: usual.toFixed(2) }) : null}
              title={t("live.focus.model.spearmanHint")}
            />
            <Tile value={tile?.n ? t("live.focus.model.podiumValue", { count: tile.podium }) : "—"} label={t("live.focus.model.podium")} />
            <Tile value={tile?.n ? tile.exact : "—"} label={t("live.focus.model.exact")} />
          </div>
          <DriverPrediction prediction={pred.byNumber[number]} driver={driver} position={position} gone={gone} />
        </>
      )}
    </div>
  );
}
