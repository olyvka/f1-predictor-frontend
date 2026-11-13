// Карта траси (C у LIVE_UI_RESEARCH §3).
// Завдання: L6. Дизайн: LIVE_UI_RESEARCH W4 (геометрія, автоповорот, прив'язка
// до контуру, інтерполяція, рендер у 2 шари Canvas, підписи без злипання,
// стани), §5.5 (кольори команд, напарник - біла крапка), §6 (чого НЕ малюємо:
// DRS-зони, жовті прапори на ділянках, номери поворотів). Власник: агент B.
//
// Пропси (фінальні):
//   layout:    "mobile" | "tablet" | "desktop" | "wide"
//   labelMode: "focus" | "top" | "all" (необов'язковий; за замовчуванням
//              "focus" на телефоні, "top" на desktop)
//
// Дані: Canvas у requestAnimationFrame читає store.getRenderTime() і
// store.getCarsAt(renderTime) (без ререндерів React); контур - useSession().track
// (geometry з src/live/geometry.js), фокус - useFocus(), статус траси - useTrackStatus().
// Заглушка нижче показує, що високочастотні дані доходять: текст оновлюється з rAF
// напряму в DOM (~4/с), без setState.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLiveStore, useSession, useFocus } from "../../live/hooks";
import { formatClock } from "../../live/format";
import WidgetStub from "./WidgetStub";

export default function TrackMap({ layout = "desktop", labelMode }) {
  const { t } = useTranslation();
  const store = useLiveStore();
  const { track, sessionStart } = useSession();
  const { focus } = useFocus();
  const out = useRef(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 250 || !out.current) return;
      last = now;
      const rt = store.getRenderTime();
      const cars = store.getCarsAt(rt);
      let ok = 0, pit = 0, gone = 0;
      let focusCar = null;
      for (const c of cars) {
        if (c.ok) ok++;
        if (c.inPit) pit++;
        if (c.gone) gone++;
        if (c.driverNumber === focus && c.ok) focusCar = `#${focus} x=${Math.round(c.x)} y=${Math.round(c.y)} f=${c.lapFraction?.toFixed(3)} d=${Math.round(c.trackDistance ?? 0)}`;
      }
      out.current.textContent = `renderTime ${rt == null || sessionStart == null ? "—" : formatClock((rt - sessionStart) / 1000, { hours: true })} · cars ok=${ok} pit=${pit} gone=${gone}${focusCar ? ` · ${focusCar}` : ""}`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [store, focus, sessionStart]);
  return (
    <WidgetStub title={t("live.map.title")} tasks="L6 · W4 · B">
      <p className="text-(--color-text-dim)">
        layout={layout} · labelMode={labelMode ?? "auto"} · track={track ? `${track.points.length} pts, ${Math.round(track.geometry.length)} units` : "null"}
      </p>
      <p ref={out} className="mt-2 font-mono-data" />
    </WidgetStub>
  );
}
