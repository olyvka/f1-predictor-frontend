// Тости W16: піт-стоп і нове найшвидше коло. Один тост за раз (4 с, на ×5+
// 2.5 с), решта в черзі (≤ 3, старші відкидаються). Після catch-up /
// перемотування (новий epoch) знімок стає базовим - тостів за минуле немає.
import { useEffect, useRef, useState } from "react";
import { useLiveSelector, shallowEqual } from "../../../live/hooks";
import { newPits, isNewFastest } from "./rc";

const MAX_QUEUE = 3;
const select = (s) => ({ pits: s.pits, best: s.best.lap, epoch: s.playback.epoch, speed: s.playback.speed });

export function useToasts() {
  const snap = useLiveSelector(["table", "playback"], select, shallowEqual);
  const prev = useRef(null);
  const [queue, setQueue] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    const p = prev.current;
    prev.current = snap;
    if (!p || p.epoch !== snap.epoch) {
      setQueue([]);
      return;
    }
    const add = [];
    for (const { driverNumber, pit } of newPits(p.pits, snap.pits)) add.push({ id: ++idRef.current, kind: "pit", driverNumber, pit });
    if (snap.best !== p.best && isNewFastest(p.best, snap.best)) add.push({ id: ++idRef.current, kind: "fastest", driverNumber: snap.best.driverNumber, time: snap.best.time });
    if (add.length) setQueue((q) => [...q, ...add].slice(-MAX_QUEUE));
  }, [snap]);

  const current = queue[0] || null;
  const duration = snap.speed >= 5 ? 2500 : 4000;
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => (q[0] === current ? q.slice(1) : q)), duration);
    return () => clearTimeout(id);
  }, [current, duration]);

  return current;
}
