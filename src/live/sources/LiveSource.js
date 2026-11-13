// Майбутнє справжнє live-джерело (L13): WS /ws/live з ТИМ САМИМ протоколом,
// але без speed/offset/pause. Бекенд цього ендпоінта ще не має - клас
// показує, як live «вставляється» без змін у сторі й віджетах:
//   - capabilities усі false → ReplayControls ховає паузу, швидкість і шкалу;
//   - mode "live" приходить у повідомленні session (store.playback.mode);
//   - перепідключення після обриву - так само з backoff, але без offset.
// Не перевірено на реальному сервері.

import { ReplaySource } from "./ReplaySource";
import { buildLiveUrl } from "./url";

export class LiveSource extends ReplaySource {
  constructor(opts) {
    super(opts);
    this.mode = "live";
    this.capabilities = { pause: false, speed: false, seek: false };
  }

  buildUrl() {
    return buildLiveUrl({ apiUrl: this.apiUrl, lang: this.lang });
  }
}
