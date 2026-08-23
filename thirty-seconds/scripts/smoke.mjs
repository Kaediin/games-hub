import { dealCard, unusedCount, PACKS } from "../js/words/index.js";
import { createGame, dealRound, toggleGuess, scoredCount, finishRound, applyMove, FINISH } from "../js/game.js";

for (const [k, v] of Object.entries(PACKS)) console.log(k, v.length);

const draft = {
  teams: [
    { name: "Burgundy", color: "burgundy", players: ["Ada"] },
    { name: "Gold", color: "gold", players: ["Bo"] },
  ],
  packs: Object.keys(PACKS),
  peek: true,
  timerSec: 30,
  customWordsText: "House special\nInside joke",
};
const game = createGame(draft);
console.log("pool", unusedCount(game), "custom", game.customWords);
dealRound(game);
console.log("card", game.round.words.map((w) => `${w.text} (${w.pack})`));
console.log("peek toggle", toggleGuess(game, 0));
game.round.phase = "playing";
toggleGuess(game, 0);
toggleGuess(game, 1);
toggleGuess(game, 2);
console.log("scored", scoredCount(game.round));
finishRound(game, { lock: true });
const r = applyMove(game);
console.log("move", r.scored, "pos", game.teams[0].position, "next", game.currentTeamIndex, "finish", FINISH);

const packs = new Set(game.log.length ? [] : []);
const seenPacks = new Set();
for (let i = 0; i < 20; i++) {
  const g = createGame(draft);
  dealRound(g);
  g.round.words.forEach((w) => seenPacks.add(w.pack));
}
console.log("packs seen over 20 deals", [...seenPacks].sort());
