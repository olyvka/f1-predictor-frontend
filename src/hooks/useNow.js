import { useEffect, useState } from "react";

/** Поточний час (мс), що оновлюється кожні `intervalMs` — для таймерів відліку. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
