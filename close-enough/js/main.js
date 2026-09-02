import { startRouter, registerRoute } from "./router.js";
import { initTheme } from "./theme.js";
import { state } from "./state.js";
import { renderHome } from "./views/home.js";
import { renderSetup } from "./views/setup.js";
import { renderLobby } from "./views/lobby.js";
import { renderRound } from "./views/round.js";
import { renderReveal } from "./views/reveal.js";
import { renderHistory } from "./views/history.js";
import { renderEnd } from "./views/end.js";

initTheme();

registerRoute("home", renderHome);
registerRoute("setup", renderSetup);
registerRoute("lobby", renderLobby);
registerRoute("round", renderRound);
registerRoute("reveal", renderReveal);
registerRoute("history", renderHistory);
registerRoute("end", renderEnd);

window.addEventListener("beforeunload", (e) => {
  const g = state.getGame();
  if (g && !g.over) {
    e.preventDefault();
    e.returnValue = "";
  }
});

startRouter();
