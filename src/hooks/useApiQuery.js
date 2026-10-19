import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Спільний хук для запитів до бекенду: прибирає повторювану loading/error
 * логіку зі сторінок. `fetcher` — функція без аргументів, що повертає
 * Promise (звично стрілка, яка замикає поточні year/round/session).
 * `deps` — масив залежностей useEffect; коли він змінюється, запит
 * перезапускається. `enabled: false` тримає хук у стані очікування, не
 * викликаючи `fetcher` (напр. поки ще не обраний рік/етап/сесія).
 *
 * Повертає ще й `refetch()` — щоб показати кнопку "Спробувати ще раз"
 * після таймауту/помилки, замість того щоб залишати користувача в глухому
 * куті.
 */
export function useApiQuery(fetcher, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [reloadToken, setReloadToken] = useState(0);
  // fetcher — нова функція на кожен рендер (замикає рік/раунд/сесію), тому
  // її саму не можна класти в deps ефекту — інакше запит йшов би на кожен
  // рендер. Тримаємо останню версію в ref і читаємо її в момент виклику.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: e.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  return { ...state, refetch };
}
