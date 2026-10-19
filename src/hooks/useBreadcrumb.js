import { useContext, useEffect } from "react";
import { BreadcrumbContext } from "../context/breadcrumbContext";

/** Сторінка викликає це, щоб оголосити свій шлях у верхньому барі. */
export function useSetBreadcrumb(items, deps) {
  const ctx = useContext(BreadcrumbContext);
  useEffect(() => {
    ctx?.setItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** TopBar читає поточні хлібні крихти. */
export function useBreadcrumbItems() {
  const ctx = useContext(BreadcrumbContext);
  return ctx?.items || [];
}
