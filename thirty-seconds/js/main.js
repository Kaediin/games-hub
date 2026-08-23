import { startRouter, registerRoute } from "./router.js";
import { initTheme } from "./theme.js";
import { sound } from "./sound.js";
import { renderHome } from "./views/home.js";
import { renderSetup } from "./views/setup.js";
import { renderBoard } from "./views/board.js";
import { renderRound } from "./views/round.js";
import { renderHistory } from "./views/history.js";
import { renderEnd } from "./views/end.js";

initTheme();
sound.init();

registerRoute("home", renderHome);
registerRoute("setup", renderSetup);
registerRoute("board", renderBoard);
registerRoute("round", renderRound);
registerRoute("history", renderHistory);
registerRoute("end", renderEnd);

startRouter();
