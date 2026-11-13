import { createContext } from "react";

/** {store, source (може бути null, поки джерело створюється), params: {year, round, session}} */
export const LiveContext = createContext(null);
