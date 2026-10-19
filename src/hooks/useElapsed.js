import { useEffect, useState } from "react";

/** Секунди з моменту, коли `active` стало true; скидається на 0, коли false. */
export function useElapsed(active) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}
