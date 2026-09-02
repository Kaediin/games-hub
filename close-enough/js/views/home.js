import { template, confirmAction, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { resumeGame } from "../play.js";

export function renderHome(root) {
  root.appendChild(template("tpl-home"));

  const hasGame = !!state.getGame();
  const resumeBtn = root.querySelector('[data-action="resume-game"]');
  if (hasGame) {
    resumeBtn.classList.remove("hidden");
    const g = state.getGame();
    resumeBtn.textContent = g?.over ? "See results" : "Resume game";
  }

  root.querySelector('[data-action="new-game"]').addEventListener("click", () => {
    if (state.getGame() && !state.getGame().over) {
      if (!confirmAction("Start a new game? Your current game will be discarded.")) return;
    }
    if (state.getGame()) state.clearGame();
    navigate("setup");
  });

  resumeBtn.addEventListener("click", () => resumeGame());
  root.querySelector('[data-action="history"]').addEventListener("click", () => navigate("history"));

  root.querySelector('[data-action="reset-data"]').addEventListener("click", () => {
    if (
      !confirmAction(
        "This will delete the current game, history and settings stored in this browser. Continue?"
      )
    )
      return;
    state.resetAll();
    toast("All local data cleared");
    setTimeout(() => location.reload(), 600);
  });
}
