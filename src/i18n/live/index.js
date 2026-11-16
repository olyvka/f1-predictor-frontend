// Рядки екрана Live, зібрані з окремих файлів на віджет - щоб паралельні
// зміни різних агентів не конфліктували. Підключаються в src/i18n/index.js
// під ключем `live`: t("live.tower.title"), t("live.common.leader")…
// Новий файл секції додається сюди (це спільний файл фундаменту).
import commonUk from "./common.uk.js";
import commonEn from "./common.en.js";
import towerUk from "./tower.uk.js";
import towerEn from "./tower.en.js";
import mapUk from "./map.uk.js";
import mapEn from "./map.en.js";
import focusUk from "./focus.uk.js";
import focusEn from "./focus.en.js";
import controlsUk from "./controls.uk.js";
import controlsEn from "./controls.en.js";
import eventsUk from "./events.uk.js";
import eventsEn from "./events.en.js";
import radioUk from "./radio.uk.js";
import radioEn from "./radio.en.js";

export const liveUk = { common: commonUk, tower: towerUk, map: mapUk, focus: focusUk, controls: controlsUk, events: eventsUk, radio: radioUk };
export const liveEn = { common: commonEn, tower: towerEn, map: mapEn, focus: focusEn, controls: controlsEn, events: eventsEn, radio: radioEn };
