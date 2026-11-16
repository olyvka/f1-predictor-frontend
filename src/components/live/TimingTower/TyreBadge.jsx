// Бейдж шини для timing tower (§5.4): кільце 3 px кольору компаунда, літера
// S/M/H/I/W/? всередині (компаунд визначає літера, не колір), вживаний комплект -
// пунктирне кільце, поруч вік комплекту в колах. Повна назва - у title/aria-label.
import { useTranslation } from "react-i18next";
import { compoundMeta } from "../../../live/tyres";

export default function TyreBadge({ compound, age, used, showAge = true }) {
  const { t } = useTranslation();
  const meta = compoundMeta(compound);
  const name = t(`live.common.tyre.${meta.key}`);
  const ageText = age != null ? t("live.tower.tyre.age", { count: age }) : null;
  const label = [name, ageText, used ? t("live.tower.tyre.used") : null].filter(Boolean).join(", ");
  return (
    <span className="lt-tyre" title={label} aria-label={label} role="img">
      <span className="lt-tyre-badge" data-used={used ? "true" : "false"} style={{ "--lt-tc": meta.color }} aria-hidden="true">
        {meta.letter}
      </span>
      {showAge && (
        <span className="lt-tyre-age tabular" aria-hidden="true">
          {age ?? "—"}
        </span>
      )}
    </span>
  );
}
