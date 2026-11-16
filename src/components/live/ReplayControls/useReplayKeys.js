// Клавіші керування replay (W9): Пробіл - пауза, ←/→ ±10 с, Shift ±60 с.
// Слухаємо window у фазі bubble: якщо віджет (таблиця, вкладки) уже обробив
// стрілки й викликав preventDefault - не втручаємось.
import { useEffect, useRef } from "react";

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
// Елементи, що самі використовують стрілки для навігації.
const OWN_ARROWS = "[role='tablist'], [role='tab'], [role='grid'], [role='listbox'], [role='menu'], [role='menubar'], [role='radiogroup'], [role='tree']";
// Пробіл на кнопці/посиланні натискає саму кнопку - не перехоплюємо.
const OWN_SPACE = "button, a[href], summary, [role='button'], [role='tab'], [role='checkbox'], [role='switch'], [role='option']";

/** handlers: {onToggle(), onNudge(seconds)}; enabled: {pause, seek}. */
export function useReplayKeys({ onToggle, onNudge, pause = true, seek = true }) {
  const ref = useRef({ onToggle, onNudge, pause, seek });
  useEffect(() => {
    ref.current = { onToggle, onNudge, pause, seek };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest(EDITABLE)) return;
      const h = ref.current;
      if (e.key === " " || e.code === "Space") {
        if (!h.pause || e.repeat || el?.closest(OWN_SPACE)) return;
        e.preventDefault();
        h.onToggle();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!h.seek || el?.closest(OWN_ARROWS)) return;
        e.preventDefault();
        const step = e.shiftKey ? 60 : 10;
        h.onNudge(e.key === "ArrowLeft" ? -step : step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
