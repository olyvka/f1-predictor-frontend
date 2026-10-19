import { formatDateTime, parseUtc, splitDuration } from "../../utils/format";
import { useNow } from "../../hooks/useNow";
import Section from "./Section";
import { t } from "../../i18n";

function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-14">
      <span className="font-mono-data text-3xl font-bold tabular-nums">{String(value).padStart(2, "0")}</span>
      <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">{label}</span>
    </div>
  );
}

// Відлік до найближчої сесії етапу. Час — з date_utc (форсований UTC, див.
// parseUtc), показ — у часовому поясі користувача. Коли всі сесії минули,
// блок зникає сам.
export default function NextSession({ sessions }) {
  const now = useNow(1000);
  const next = sessions
    .map((s) => ({ ...s, at: parseUtc(s.date_utc) }))
    .find((s) => s.at && s.at.getTime() > now);
  if (!next) return null;

  const left = splitDuration(next.at.getTime() - now);

  return (
    <Section title={t("nextSession.title")}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-lg font-bold uppercase">
            <span className="text-(--color-accent)">{next.code}</span> · {next.name}
          </span>
          <span className="text-sm text-(--color-text-dim) font-mono-data">{formatDateTime(next.at.toISOString())}</span>
        </div>
        <div className="flex gap-2" role="timer" aria-live="off">
          <Unit value={left.days} label={t("units.d")} />
          <Unit value={left.hours} label={t("units.h")} />
          <Unit value={left.minutes} label={t("units.m")} />
          <Unit value={left.seconds} label={t("units.s")} />
        </div>
      </div>
    </Section>
  );
}
