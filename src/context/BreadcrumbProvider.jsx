import { useMemo, useState } from "react";
import { BreadcrumbContext } from "./breadcrumbContext";

// Хлібні крихти живуть у верхньому фіксованому барі (App.jsx), не в тілі
// кожної сторінки — сторінка лише "оголошує" свій шлях через
// useSetBreadcrumb(items) (src/hooks/useBreadcrumb.js), а TopBar читає
// поточне значення з цього контексту.
export function BreadcrumbProvider({ children }) {
  const [items, setItems] = useState([]);
  const value = useMemo(() => ({ items, setItems }), [items]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}
