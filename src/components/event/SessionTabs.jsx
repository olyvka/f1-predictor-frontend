import { NavLink } from "react-router-dom";
import { isFuture } from "../../utils/format";
import { t } from "../../i18n";

const pillBase = "px-3 py-1.5 text-xs uppercase tracking-wide rounded-full transition-colors flex items-center gap-1.5";
const pillActive = "bg-(--color-accent) text-white font-semibold";
const pillIdle = "text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface)";
const pillDisabled = "text-(--color-text-dim)/40 cursor-not-allowed";

// Набір сесій будується динамічно з /api/sessions (не хардкодиться) —
// на спринт-вікенді це FP1/SQ/S/Q/R, на звичайному FP1/FP2/FP3/Q/R.
export default function SessionTabs({ sessions }) {
  return (
    <nav className="flex flex-wrap gap-1 bg-(--color-surface) border border-(--color-line) rounded-full p-1">
      <NavLink to="" end className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillIdle}`}>
        {t("tabs.overview")}
      </NavLink>

      {sessions.map((s) => {
        const future = isFuture(s.date);
        return (
          <NavLink
            key={s.code}
            to={future ? "#" : s.code}
            onClick={(e) => future && e.preventDefault()}
            title={future ? t("session.notYet") : undefined}
            aria-disabled={future || undefined}
            tabIndex={future ? -1 : undefined}
            className={({ isActive }) =>
              `${pillBase} ${future ? pillDisabled : isActive ? pillActive : pillIdle}`
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: future ? "var(--color-text-dim)" : "var(--color-good)" }}
              aria-hidden="true"
            />
            {s.code}
          </NavLink>
        );
      })}

      <NavLink to="analysis" className={({ isActive }) => `${pillBase} ${isActive ? pillActive : pillIdle}`}>
        {t("tabs.prediction")}
      </NavLink>
    </nav>
  );
}
