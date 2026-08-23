import { template, confirmAction, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

export function renderHome(root) {
  root.appendChild(template("tpl-home"));

  const hasGame = !!state.getGame();
  const resumeBtn = root.querySelector('[data-action="resume-game"]');
  if (hasGame) resumeBtn.classList.remove("hidden");

  root.querySelector('[data-action="new-game"]').addEventListener("click", () => {
    if (state.getGame()) {
      if (!confirmAction("Start a new game? Your current game will be discarded.")) return;
      state.clearGame();
    }
    // Keep the entire previous draft (players, teams, spymasters) so the
    // group can keep the same setup across rounds. Users can tweak or
    // hit "Clear" / "Randomise" on the assign view.
    const draft = state.getDraft();
    navigate(draft.players.length >= 4 ? "assign" : "setup");
  });

  resumeBtn.addEventListener("click", () => {
    const g = state.getGame();
    navigate(g?.over ? "end" : "play");
  });

  root.querySelector('[data-action="history"]').addEventListener("click", () => navigate("history"));

  root.querySelector('[data-action="reset-data"]').addEventListener("click", () => {
    if (!confirmAction("This will delete the current game, history and settings stored in this browser. Continue?")) return;
    state.resetAll();
    toast("All local data cleared");
    setTimeout(() => location.reload(), 600);
  });
}
