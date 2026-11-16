// Вибір джерела даних для екрана Live за параметрами адреси.
//   ?source=fixture[&fixture=brazil-2026-quali][&drop=10] - офлайн-фікстура (лише dev
//     або збірка з VITE_LIVE_FIXTURES=1); drop=N імітує обрив через N с.
//   kind "live" - LiveSource до WS /ws/live (поточна сесія, платна підписка OpenF1).
//   інакше - ReplaySource до бекенду (VITE_API_URL).
// Стор і віджети від джерела не залежать.

import { ReplaySource } from "./sources/ReplaySource";
import { LiveSource } from "./sources/LiveSource";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Чи доступний офлайн-режим фікстур у цій збірці. */
export const FIXTURES_ENABLED = import.meta.env.DEV || import.meta.env.VITE_LIVE_FIXTURES === "1";

/**
 * Promise<source>. opts: {store, kind: "backend"|"fixture"|"live", fixtureName, year, round,
 * session, speed, offset, lang, dropAfterSeconds, onWaiting}.
 */
export async function createLiveSource({ kind = "backend", fixtureName, dropAfterSeconds, onWaiting, ...opts }) {
  if (kind === "live") return new LiveSource({ ...opts, onWaiting, apiUrl: API_URL, log: logger("live") });
  if (kind === "fixture") {
    if (!FIXTURES_ENABLED) throw new Error("fixtures-disabled");
    const { FixtureSource, loadFixture, defaultFixtureFor } = await import("./sources/FixtureSource");
    const name = fixtureName || defaultFixtureFor(opts.session);
    return new FixtureSource({
      ...opts,
      fixture: loadFixture(name),
      dropAfterMs: Number.isFinite(dropAfterSeconds) && dropAfterSeconds > 0 ? dropAfterSeconds * 1000 : null,
      log: logger(`fixture:${name}`),
    });
  }
  return new ReplaySource({ ...opts, apiUrl: API_URL, log: logger("replay") });
}

function logger(tag) {
  return (event, info) => console.log(`%c[live:${tag}] ${event}`, "color:#8a929c", info ?? "");
}
