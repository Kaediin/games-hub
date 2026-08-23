import { startRouter, registerRoute } from "./router.js";
import { initTheme } from "./theme.js";
import { sound } from "./sound.js";
import { renderHome } from "./views/home.js";
import { renderSetup } from "./views/setup.js";
import { renderAssign } from "./views/assign.js";
import { renderQr } from "./views/qr.js";
import { renderPlay } from "./views/play.js";
import { renderHistory } from "./views/history.js";
import { renderEnd } from "./views/end.js";
import { renderKey } from "./views/key.js";

initTheme();
sound.init();

registerRoute("home", renderHome);
registerRoute("setup", renderSetup);
registerRoute("assign", renderAssign);
registerRoute("qr", renderQr);
registerRoute("play", renderPlay);
registerRoute("history", renderHistory);
registerRoute("end", renderEnd);
registerRoute("key", renderKey);

startRouter();
