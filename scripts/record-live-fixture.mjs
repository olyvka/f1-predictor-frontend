#!/usr/bin/env node
// Записує сирі повідомлення replay-протоколу (WS /ws/replay/...) у JSON-фікстуру
// для тестів стору і офлайн-режиму екрана Live (?source=fixture).
//
// Використання (бекенд має працювати локально):
//   node scripts/record-live-fixture.mjs --path /ws/replay/2026/20/R \
//        --offset 1320 --speed 5 --seconds 30 --out src/live/__fixtures__/brazil-2026-race.json
//
// Параметри:
//   --api      база бекенду (за замовчуванням VITE_API_URL або http://localhost:8000)
//   --path     шлях WebSocket без query
//   --offset   секунди від запланованого старту сесії
//   --speed    швидкість replay
//   --seconds  скільки секунд реального часу писати ПІСЛЯ catch-up
//   --lang     мова повідомлень (uk|en)
//   --out      файл фікстури
//   --max-mb   ліміт розміру; якщо більше - обрізаємо хвіст батчів (за замовчуванням 5)
//
// Формат фікстури:
//   { meta: { path, offset, speed, lang, recordedAt, seconds },
//     messages: [ { at: <мс від відкриття з'єднання>, msg: <повідомлення сервера> }, ... ] }
// `at` потрібне FixtureSource, щоб програвати з тим самим темпом, що й бекенд.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const api = args.api || process.env.VITE_API_URL || "http://localhost:8000";
const path = args.path || "/ws/replay/2026/20/R";
const offset = Number(args.offset ?? 0);
const speed = Number(args.speed ?? 1);
const seconds = Number(args.seconds ?? 30);
const lang = args.lang || "uk";
const out = args.out || "src/live/__fixtures__/fixture.json";
const maxBytes = Number(args["max-mb"] ?? 5) * 1024 * 1024;

const wsBase = api.replace(/^http(s?):\/\//i, (_, s) => `ws${s}://`).replace(/\/+$/, "");
const url = `${wsBase}${path}?speed=${speed}&offset=${offset}&lang=${lang}`;

if (typeof WebSocket === "undefined") {
  console.error("Потрібен Node 22+ (глобальний WebSocket).");
  process.exit(1);
}

console.log(`→ ${url}`);
const messages = [];
const t0 = Date.now();
let stopTimer = null;
let caughtUp = false;
const ws = new WebSocket(url);

function finish(reason) {
  clearTimeout(stopTimer);
  try {
    ws.close();
  } catch {
    /* вже закрито */
  }
  // Обрізаємо хвіст, якщо фікстура завелика: перші session + catch-up лишаються завжди.
  let json = JSON.stringify({ meta: meta(reason), messages });
  while (json.length > maxBytes && messages.length > 3) {
    messages.splice(Math.max(3, Math.floor(messages.length * 0.9)));
    json = JSON.stringify({ meta: meta(reason + " (обрізано за розміром)"), messages });
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  const counts = {};
  for (const { msg } of messages) {
    if (msg.type === "batch") for (const e of msg.events) counts[e.topic] = (counts[e.topic] || 0) + 1;
    else counts[`<${msg.type}>`] = (counts[`<${msg.type}>`] || 0) + 1;
  }
  console.log(`✓ ${out}: ${(json.length / 1024 / 1024).toFixed(2)} МБ, ${messages.length} повідомлень (${reason})`);
  console.log(counts);
  process.exit(0);
}

function meta(reason) {
  const last = messages.at(-1);
  return { path, offset, speed, lang, recordedAt: new Date(t0).toISOString(), seconds, durationMs: last?.at ?? 0, stop: reason };
}

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
  messages.push({ at: Date.now() - t0, msg });
  if (msg.type === "batch" && msg.catchup && !caughtUp) {
    caughtUp = true;
    console.log(`  catch-up: ${msg.events.length} подій, через ${Date.now() - t0} мс`);
    stopTimer = setTimeout(() => finish("time"), seconds * 1000);
  } else if (msg.type === "session") {
    console.log(`  session: ${msg.session?.session_name}, ${msg.drivers?.length} пілотів, track=${msg.track ? msg.track.points.length + " точок" : "null"}`);
  } else if (msg.type === "error") {
    console.log(`  error: ${msg.detail}`);
  } else if (msg.type === "end") {
    finish("end");
  }
});
ws.addEventListener("close", (ev) => {
  if (messages.length) finish(`close ${ev.code}`);
  else {
    console.error(`З'єднання закрите без повідомлень (code ${ev.code})`);
    process.exit(1);
  }
});
ws.addEventListener("error", () => {
  console.error("Помилка WebSocket (бекенд запущено?)");
});
