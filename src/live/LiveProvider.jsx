import { useMemo } from "react";
import { LiveContext } from "./context";

// Дає віджетам доступ до стору, джерела й параметрів сесії (хуки з ./hooks).
export default function LiveProvider({ store, source, params, children }) {
  const value = useMemo(() => ({ store, source, params }), [store, source, params]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
