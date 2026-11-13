// Джерело даних replay (L1, L13): керує WebSocket-з'єднанням і більше нічого
// не знає про UI. Повідомлення передає в стор (store.receive), стан
// з'єднання - через store.setConnection.
//
// Машина станів (playback.status у сторі):
//   connecting → loading (сокет відкрито, session ще немає)
//     → playing | paused | buffering → ended | error | lost
//   - buffering: clock у batch не росте > BUFFERING_MS реального часу, хоча не пауза;
//   - lost: обрив без end/error → автопідключення з backoff 1/2/4/8/15 с,
//     offset = останній clock − session.date_start (перегляд триває з того ж місця);
//   - error: після `error` автопідключення немає, лише retry() від користувача.
//
// Кожне з'єднання має свій connId: пізні повідомлення старого сокета (після
// seek/retry) відкидаються. Стор скидається, коли НОВЕ з'єднання надсилає
// session, тож під час перемотування останній кадр лишається на екрані
// (playback.seeking != null - віджети його приглушують).

import { buildReplayUrl, roundOffset } from "./url";
import { parseTime } from "../time";
import { clampSpeed } from "../store";

export const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
export const BUFFERING_MS = 2000;
const WS_OPEN = 1;

const defaultNow = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

export class ReplaySource {
  /**
   * opts: {store, year, round, session, speed, offset, lang, apiUrl,
   *        WebSocketImpl (за замовчуванням глобальний WebSocket), now, log}
   */
  constructor({ store, year, round, session, speed = 1, offset = 0, lang = "uk", apiUrl, WebSocketImpl, now = defaultNow, log = null }) {
    this.store = store;
    this.params = { year, round, session };
    this.apiUrl = apiUrl;
    this.lang = lang;
    this.speed = clampSpeed(speed);
    this.offset = Number(offset) || 0;
    this.WebSocketImpl = WebSocketImpl || globalThis.WebSocket;
    this.now = now;
    this.log = log;

    this.mode = "replay";
    this.capabilities = { pause: true, speed: true, seek: true };

    this.ws = null;
    this.connId = 0;
    this.status = "idle";
    this.attempt = 0; // номер спроби автопідключення
    this.sessionStart = null; // мс epoch
    this.lastClock = null; // мс epoch останнього clock поточного з'єднання
    this.lastAdvanceAt = 0; // now() останнього зростання clock
    this.gotSession = false;
    this.errored = false; // було `error` - без автопідключення
    this.ended = false;
    this.wantPaused = false;
    this.closed = false;
    this.reconnectTimer = null;
    this.watchTimer = null;
  }

  /** Адреса з'єднання для offset (перевизначає LiveSource). */
  buildUrl(offset) {
    return buildReplayUrl({ apiUrl: this.apiUrl, ...this.params, speed: this.speed, offset, lang: this.lang });
  }

  start() {
    this.closed = false;
    this._connect(this.offset);
    return this;
  }

  // --- команди ---
  pause() {
    if (!this.capabilities.pause || this.wantPaused) return;
    this.wantPaused = true;
    this.store.setPaused(true); // оптимістично: годинник стоїть одразу
    this._send({ action: "pause" });
    if (this._isStreaming()) this._setStatus("paused");
  }

  resume() {
    if (!this.capabilities.pause || !this.wantPaused) return;
    this.wantPaused = false;
    this.lastAdvanceAt = this.now();
    this.store.setPaused(false);
    this._send({ action: "resume" });
    if (this._isStreaming()) this._setStatus("playing");
  }

  togglePause() {
    if (this.wantPaused) this.resume();
    else this.pause();
  }

  setSpeed(value) {
    if (!this.capabilities.speed) return;
    this.speed = clampSpeed(value);
    this.store.setSpeed(this.speed);
    this._send({ action: "speed", value: this.speed });
  }

  /** Перемотування = нове з'єднання з іншим offset (секунди від запланованого старту). */
  seek(offsetSeconds) {
    if (!this.capabilities.seek) return;
    const offset = roundOffset(offsetSeconds);
    this.store.beginSeek(offset);
    this.attempt = 0;
    this._connect(offset);
  }

  /** Повтор після error/lost (кнопка «Спробувати ще»): з останнього місця. */
  retry() {
    this.attempt = 0;
    this._connect(this.resumeOffset());
  }

  /** Закрити назавжди (unmount екрана). */
  close() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.watchTimer);
    this.reconnectTimer = this.watchTimer = null;
    this.connId++; // будь-що від старого сокета далі ігнорується
    this._closeSocket();
  }

  /** offset для відновлення: останній clock − session.date_start, інакше початковий. */
  resumeOffset() {
    if (this.lastClock != null && this.sessionStart != null) return roundOffset((this.lastClock - this.sessionStart) / 1000);
    return this.offset;
  }

  // --- внутрішнє ---
  _isStreaming() {
    return this.gotSession && ["playing", "paused", "buffering"].includes(this.status);
  }

  _setStatus(status, extra = {}) {
    this.status = status;
    this.store.setConnection({ status, ...extra });
  }

  _send(obj) {
    const ws = this.ws;
    if (ws && ws.readyState === WS_OPEN) {
      try {
        ws.send(JSON.stringify(obj));
      } catch {
        /* сокет закривається - стан відновиться при перепідключенні */
      }
    }
  }

  _closeSocket() {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close(1000);
    } catch {
      /* вже закрито */
    }
  }

  _connect(offset) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this._closeSocket();
    const id = ++this.connId;
    this.offset = offset;
    this.gotSession = false;
    this.errored = false;
    this.ended = false;
    this.lastClock = null;
    this.closed = false;
    const url = this.buildUrl(offset);
    this.log?.("connect", { id, url });
    this._setStatus("connecting", { connId: id, error: null, reconnect: null, mode: this.mode, speed: this.speed });

    let ws;
    try {
      ws = new this.WebSocketImpl(url);
    } catch (e) {
      this._setStatus("error", { error: String(e?.message || e) });
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (id !== this.connId) return;
      this._setStatus("loading");
    };
    ws.onmessage = (ev) => {
      if (id !== this.connId) return; // пізнє повідомлення старого з'єднання
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      } catch {
        return;
      }
      this._handle(msg);
    };
    ws.onerror = () => {
      /* за error завжди йде close - обробляємо там */
    };
    ws.onclose = (ev) => {
      if (id !== this.connId) return;
      this.ws = null;
      this._onClose(ev);
    };

    clearInterval(this.watchTimer);
    this.watchTimer = setInterval(() => this._watch(id), 500);
  }

  _handle(msg) {
    switch (msg.type) {
      case "session":
        this.gotSession = true;
        this.attempt = 0;
        this.sessionStart = parseTime(msg.session?.date_start);
        if (msg.mode) this.mode = msg.mode;
        this.store.receive(msg);
        this.lastAdvanceAt = this.now();
        if (this.wantPaused) {
          this._send({ action: "pause" });
          this.store.setPaused(true);
          this._setStatus("paused");
        } else {
          this._setStatus("playing");
        }
        return;
      case "batch": {
        this.store.receive(msg);
        const clock = parseTime(msg.clock);
        if (clock != null && (this.lastClock == null || clock > this.lastClock)) {
          this.lastClock = clock;
          this.lastAdvanceAt = this.now();
          if (this.status === "buffering" || this.status === "error") this._setStatus(this.wantPaused ? "paused" : "playing");
        }
        return;
      }
      case "state": {
        this.store.receive(msg);
        const clock = parseTime(msg.clock);
        if (clock != null) this.lastClock = clock;
        if (msg.speed != null) this.speed = clampSpeed(msg.speed);
        // Відповідь сервера синхронізує стан, але не перебиває новішу дію користувача.
        if (!!msg.paused === this.wantPaused && this._isStreaming()) this._setStatus(msg.paused ? "paused" : "playing");
        this.lastAdvanceAt = this.now();
        return;
      }
      case "error":
        this.errored = true;
        this.store.receive(msg);
        this._setStatus("error", { error: msg.detail ?? null });
        return;
      case "end":
        this.ended = true;
        this.store.receive(msg);
        clearInterval(this.watchTimer);
        this._setStatus("ended");
        return;
      default:
        return;
    }
  }

  _onClose(ev) {
    clearInterval(this.watchTimer);
    this.watchTimer = null;
    if (this.closed || this.ended) return;
    if (this.errored) {
      this._setStatus("error");
      return;
    }
    this.log?.("lost", { code: ev?.code });
    const delayMs = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    const offset = this.resumeOffset();
    this._setStatus("lost", { reconnect: { attempt: this.attempt, delayMs, retryAt: this.now() + delayMs } });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closed) this._connect(offset);
    }, delayMs);
  }

  _watch(id) {
    if (id !== this.connId) return;
    if (this.status === "playing" && this.gotSession && this.now() - this.lastAdvanceAt > BUFFERING_MS) {
      this._setStatus("buffering");
    }
  }
}
