// Справжнє live-джерело (L13): WS /ws/live з ТИМ САМИМ протоколом, що й replay,
// але без speed/offset/pause:
//   - capabilities усі false → ReplayControls ховає паузу, швидкість і шкалу;
//   - mode "live" приходить у повідомленні session (store.playback.mode);
//   - перепідключення після обриву - так само з backoff, сервер сам віддає
//     свіжий стан (catch-up), offset не потрібен;
//   - поза live-вікном OpenF1 (за 30 хв до старту - 30 хв після кінця) сервер
//     шле {"type": "waiting", session, opens_at, calendar} і закриває з'єднання:
//     це не обрив, тож не перепідключаємось, а віддаємо його сторінці (onWaiting).

import { ReplaySource } from "./ReplaySource";
import { buildLiveUrl } from "./url";

export class LiveSource extends ReplaySource {
  constructor({ onWaiting, ...opts }) {
    super(opts);
    this.mode = "live";
    this.capabilities = { pause: false, speed: false, seek: false };
    this.onWaiting = onWaiting;
  }

  buildUrl() {
    return buildLiveUrl({ apiUrl: this.apiUrl, lang: this.lang });
  }

  _handle(msg) {
    if (msg?.type === "waiting") {
      this.ended = true; // з'єднання закриє сервер - без перепідключення
      clearInterval(this.watchTimer);
      this._setStatus("ended");
      this.onWaiting?.(msg);
      return;
    }
    super._handle(msg);
  }
}
