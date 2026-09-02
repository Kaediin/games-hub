import { state } from "./state.js";
import { navigate } from "./router.js";

export function resumeRoute(game = state.getGame()) {
  if (!game) return "home";
  if (game.over) return "end";
  if (!game.currentRound) return "lobby";
  if (game.currentRound.status === "revealed") return "reveal";
  return "round";
}

export function resumeGame() {
  navigate(resumeRoute());
}

export function persist(game) {
  state.saveGame(game);
  return game;
}
