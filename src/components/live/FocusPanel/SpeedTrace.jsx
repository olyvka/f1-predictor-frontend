// Траса швидкості кола (W6, L8): Canvas, X - частка кола 0-100 % (семпл car_data
// → найближчий location → проєкція на контур; рахує стор, store.getSpeedTrace).
// Поточне коло - суцільна лінія кольору команди, попереднє - пунктир, зони
// гальмування поточного кола затінені. Суперник (useFocus().rival) - пунктир
// його кольору (напарник: той самий колір, суцільна + пунктир).
// Мітки лише 100/200/300 км/год, без сітки. Перемальовування ≤ 4/с, децимація
// min/max на піксель.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocus, useSession, useSpeedTrace, useTower } from "../../../live/hooks";
import { TRACE_LABELS, TRACE_VMAX, brakeZones, decimate, maxSpeed, splitSegments, traceState } from "./helpers";

const MIN_REDRAW_MS = 250;
const HEIGHT = 128;
const PAD = { l: 26, r: 4, t: 6, b: 6 };

function readColors(el) {
  const cs = getComputedStyle(el);
  const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
  return {
    dim: v("--color-text-dim", "#8b909a"),
    line: v("--color-line", "#23262d"),
    brake: v("--color-danger", "#ef4444"),
    font: v("--font-body", "Inter, system-ui, sans-serif"),
  };
}

function drawPolyline(ctx, segments, X, Y, width) {
  ctx.beginPath();
  for (const seg of segments) {
    const pts = decimate(seg, width);
    for (let i = 0; i < pts.length; i++) {
      const x = X(pts[i].f);
      const y = Y(pts[i].speed);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function draw(canvas, size, colors, { trace, rivalTrace, color, rivalColor }) {
  const dpr = window.devicePixelRatio || 1;
  const W = size.w;
  const H = size.h;
  if (!(W > 0 && H > 0)) return;
  const bw = Math.round(W * dpr);
  const bh = Math.round(H * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const X = (f) => PAD.l + f * plotW;
  const Y = (v) => PAD.t + plotH - (Math.max(0, Math.min(TRACE_VMAX, v)) / TRACE_VMAX) * plotH;

  // Мітки 100/200/300 (без сітки).
  ctx.font = `10px ${colors.font}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.dim;
  for (const v of TRACE_LABELS) ctx.fillText(String(v), 0, Y(v));
  // Базова лінія осі X - тонка, щоб «підлога» графіка читалась.
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.l, PAD.t + plotH + 0.5);
  ctx.lineTo(W - PAD.r, PAD.t + plotH + 0.5);
  ctx.stroke();

  if (!trace) return;
  const current = trace.current || [];

  // Зони гальмування поточного кола.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.brake;
  for (const [a, b] of brakeZones(current)) ctx.fillRect(X(a), PAD.t, Math.max(1, X(b) - X(a)), plotH);
  ctx.restore();

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Попереднє коло: пунктир приглушеним кольором.
  if (trace.previous?.length) {
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = colors.dim;
    drawPolyline(ctx, splitSegments(trace.previous), X, Y, plotW);
  }
  // Суперник: поточне коло пунктиром у його кольорі.
  if (rivalTrace?.current?.length) {
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rivalColor;
    drawPolyline(ctx, splitSegments(rivalTrace.current), X, Y, plotW);
  }
  // Поточне коло пілота у фокусі - зверху.
  if (current.length) {
    ctx.setLineDash([]);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = color;
    drawPolyline(ctx, splitSegments(current), X, Y, plotW);
    const last = current[current.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X(last.f), Y(last.speed), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.setLineDash([]);
}

function LegendLine({ color, dashed, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="16" height="6" aria-hidden="true" className="shrink-0">
        <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function RivalSelect({ number, rival, setRival }) {
  const { t } = useTranslation();
  const { drivers } = useSession();
  const { rows } = useTower();
  // Порядок як у таблиці (за позицією) - так шукати суперника найпростіше.
  const options = useMemo(() => rows.filter((r) => r.driverNumber !== number).map((r) => r.driverNumber), [rows, number]);
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-(--color-text-dim) normal-case tracking-normal font-normal">
      <span className="sr-only sm:not-sr-only">{t("live.focus.trace.rival")}</span>
      <select
        value={rival != null && rival !== number ? String(rival) : ""}
        onChange={(e) => setRival(e.target.value === "" ? null : Number(e.target.value))}
        className="bg-(--color-surface-2) border border-(--color-line) rounded px-1 py-0.5 text-[11px] text-(--color-text) max-w-[8.5rem]"
        aria-label={t("live.focus.trace.rival")}
      >
        <option value="">{t("live.focus.trace.noRival")}</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {drivers[n]?.acronym ?? n}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SpeedTrace({ number, driver }) {
  const { t } = useTranslation();
  const { track, drivers } = useSession();
  const { rival, setRival } = useFocus();
  const rivalNumber = rival != null && rival !== number ? rival : null;
  const rivalDriver = rivalNumber != null ? drivers[rivalNumber] : null;
  const trace = useSpeedTrace(number);
  const rivalTrace = useSpeedTrace(rivalNumber);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: HEIGHT });
  const colorsRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      setSize((s) => (s.w === w ? s : { w, h: HEIGHT }));
      colorsRef.current = readColors(el);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Дані для малювання - у ref; сам малюнок тротлиться до ≤ 4/с.
  const color = driver?.color || "#ffffff";
  const rivalColor = rivalDriver?.color || "#ffffff";
  const latest = useRef(null);
  latest.current = { trace, rivalTrace, color, rivalColor };
  const lastDrawRef = useRef(0);
  const timerRef = useRef(null);
  useEffect(() => {
    const run = () => {
      timerRef.current = null;
      lastDrawRef.current = performance.now();
      const canvas = canvasRef.current;
      if (canvas && colorsRef.current) draw(canvas, size, colorsRef.current, latest.current);
    };
    const wait = MIN_REDRAW_MS - (performance.now() - lastDrawRef.current);
    if (wait <= 0) run();
    else if (!timerRef.current) timerRef.current = setTimeout(run, wait);
  }, [trace, rivalTrace, color, rivalColor, size]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const state = traceState(trace);
  const noTrack = !track;
  const top = maxSpeed(trace?.current);
  const note =
    noTrack ? t("live.focus.trace.noTrack")
    : state === "empty" ? t("live.focus.trace.empty")
    : state === "afterSeek" ? t("live.focus.trace.afterSeek")
    : state === "partial" ? t("live.focus.trace.partial")
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-dim)">{t("live.focus.trace.title")}</h4>
        <RivalSelect number={number} rival={rival} setRival={setRival} />
      </div>
      <div ref={wrapRef} className="relative w-full" style={{ height: HEIGHT }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          role="img"
          aria-label={t("live.focus.trace.aria", { driver: driver?.acronym ?? "", max: top != null ? Math.round(top) : "—" })}
        />
        {(noTrack || state === "empty") && (
          <p className="absolute inset-0 flex items-center justify-center text-center px-6 text-xs text-(--color-text-dim) pointer-events-none">
            {note}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-(--color-text-dim)">
        <LegendLine color={color} label={trace?.lapNumber != null ? t("live.focus.trace.current", { lap: trace.lapNumber }) : t("live.focus.trace.currentNoLap")} />
        {trace?.previous?.length > 0 && (
          <LegendLine
            color="var(--color-text-dim)"
            dashed
            label={trace.previousLapNumber != null ? t("live.focus.trace.previous", { lap: trace.previousLapNumber }) : t("live.focus.trace.previousNoLap")}
          />
        )}
        {rivalDriver && <LegendLine color={rivalColor} dashed label={rivalDriver.acronym} />}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-(--color-danger)/25" aria-hidden="true" />
          {t("live.focus.trace.brake")}
        </span>
        <span className="ml-auto">{t("live.focus.trace.axis")} 0–100%</span>
        {!noTrack && (state === "partial" || state === "afterSeek") && <span className="basis-full">{note}</span>}
      </div>
    </div>
  );
}
