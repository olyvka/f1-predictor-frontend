// Шапка панелі фокусу (W5): фото/монограма в кольорі команди, ім'я, команда,
// позиція, шина з віком, інтервал. Без вибору - лідер і підказка.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../../live/hooks";
import { formatGap } from "../../../live/format";
import { compoundMeta, isUsedSet } from "../../../live/tyres";
import { textOn } from "../../../live/color";

function Avatar({ driver, size = 44 }) {
  const [broken, setBroken] = useState(null);
  const url = driver?.headshot_url;
  // Скидаємо «бите фото», коли змінився пілот (без ефекту: порівнюємо з URL).
  const showPhoto = url && broken !== url;
  const color = driver?.color || "var(--color-tyre-unknown)";
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: showPhoto ? "var(--color-surface-2)" : color, boxShadow: `0 0 0 2px ${color}` }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img src={url} alt="" className="w-full h-full object-cover object-top" loading="lazy" onError={() => setBroken(url)} />
      ) : (
        <span className="font-bold text-[13px] tracking-wide" style={{ color: driver?.color ? textOn(driver.color) : "#fff" }}>
          {driver?.acronym || "?"}
        </span>
      )}
    </span>
  );
}

export function TyreBadge({ stint, age, size = 22 }) {
  const { t } = useTranslation();
  if (!stint) return null;
  const meta = compoundMeta(stint.compound);
  const used = isUsedSet(stint);
  const name = t(`live.common.tyre.${meta.key}`);
  const label = `${name}${age != null ? ` · ${t("live.focus.tyreAge", { count: age })}` : ""}${used ? ` · ${t("live.common.tyre.used")}` : ""}`;
  return (
    <span className="inline-flex items-center gap-1" title={label} aria-label={label} role="img">
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-[11px] leading-none"
        style={{ width: size, height: size, border: `3px ${used ? "dashed" : "solid"} ${meta.color}` }}
        aria-hidden="true"
      >
        {meta.letter}
      </span>
      {age != null && (
        <span className="tabular text-xs text-(--color-text-dim)" aria-hidden="true">
          {age}
        </span>
      )}
    </span>
  );
}

export default function Header({ detail, driver, number, isFallback, onClear }) {
  const { t } = useTranslation();
  const { isRace } = useSession();
  if (!driver) {
    return (
      <div className="px-3 py-3 text-sm text-(--color-text-dim)">
        {t("live.focus.noDriver")}
      </div>
    );
  }
  const position = detail?.position;
  const interval = detail?.intervals?.interval;
  const isLeader = position === 1;
  const intervalText = isLeader ? t("live.common.leader") : formatGap(interval, { t });
  return (
    <div className="flex flex-col gap-1.5 px-3 pt-3 pb-2 border-b border-(--color-line)">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar driver={driver} />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[15px] font-semibold leading-tight truncate" title={driver.full_name}>
            {driver.full_name || driver.acronym}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-(--color-text-dim) min-w-0">
            <span className="inline-block w-1 h-3 rounded-sm shrink-0" style={{ background: driver.color }} aria-hidden="true" />
            <span className="truncate">{driver.team_name}</span>
            <span className="tabular shrink-0">{t("live.focus.number", { number })}</span>
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <TyreBadge stint={detail?.stint} age={detail?.tyreAge} size={20} />
            {isRace && (
              <span className="tabular text-xs text-(--color-text-dim) truncate" title={t("live.focus.interval")}>
                {intervalText}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 self-start shrink-0">
          <span className="tabular text-[24px] font-bold leading-none" aria-label={`${t("live.focus.position")} ${position ?? "—"}`}>
            {position != null ? `P${position}` : "—"}
          </span>
          {detail?.inPit && !detail?.gone && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-(--color-pit-lane) text-white">{t("live.focus.pitChip")}</span>
          )}
          {detail?.gone && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-(--color-line) text-(--color-text-dim)">
              {isRace ? t("live.focus.outChip") : t("live.focus.garageChip")}
            </span>
          )}
        </div>
        {!isFallback && (
          <button
            type="button"
            onClick={onClear}
            className="self-start -mr-1 -mt-1 w-7 h-7 inline-flex items-center justify-center rounded text-base text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface-hover) transition-colors duration-100"
            aria-label={t("live.focus.clearFocus")}
            title={t("live.focus.clearFocus")}
          >
            ×
          </button>
        )}
      </div>
      {isFallback && (
        <p className="text-xs text-(--color-text-dim)">
          {t("live.focus.showingLeader")} {t("live.focus.pickHint")}.
        </p>
      )}
    </div>
  );
}
