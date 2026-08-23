import { template, el, confirmAction, toast, sleep } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import {
  currentTeam,
  describerName,
  paletteFor,
  dealRound,
  FINISH,
} from "../game.js";
import { spaceCoords, pathD, VIEW_W, VIEW_H } from "../boardMap.js";
import { unusedCount } from "../words/index.js";
import { sound } from "../sound.js";
import { timer } from "../timer.js";

const COORDS = spaceCoords();

// Visual-only drink stops (art + labels). Landing on them changes nothing
// about scoring or turns — see checkpoints todo in the vineyard plan.
const CHECKPOINTS = [
  { idx: 0, key: "cellar", label: "Cellar" },
  { idx: 9, key: "pour", label: "Pour!" },
  { idx: 18, key: "terrace", label: "Refill" },
  { idx: 27, key: "lastcall", label: "Last call" },
  { idx: FINISH, key: "chateau", label: "Château" },
];
const CHECKPOINT_IDX = new Set(CHECKPOINTS.map((c) => c.idx));

export function renderBoard(root) {
  const game = state.getGame();
  if (!game) {
    toast("No game in progress");
    navigate("home");
    return;
  }
  if (game.over && !game.lastMove) {
    navigate("end");
    return;
  }

  timer.stop();
  root.appendChild(template("tpl-board"));

  const svg = root.querySelector("#vineyard");
  svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
  svg.appendChild(drawDefs());
  svg.appendChild(drawBackdrop());
  svg.appendChild(drawPath());
  svg.appendChild(drawSpaces());
  svg.appendChild(drawLandmarks());
  const pawnsLayer = elNS("g", { class: "pawns-layer" });
  svg.appendChild(pawnsLayer);

  const team = currentTeam(game);
  const pal = paletteFor(team.color);
  const who = describerName(team);
  root.querySelector("#turn-team").textContent = team.name;
  root.querySelector("#turn-team").style.color = pal.hex;
  root.querySelector("#turn-detail").textContent = who
    ? `${who} describes this round`
    : "Pick a describer, then start";
  root.querySelector("#turn-banner").style.setProperty("--team", pal.hex);

  const standings = root.querySelector("#standings");
  game.teams.forEach((t) => {
    const p = paletteFor(t.color);
    standings.appendChild(
      el(
        "li",
        { class: "standing", style: `--team:${p.hex}` },
        el("span", { class: "pawn-mini", style: `background:${p.hex}` }),
        el("span", { class: "standing-name" }, t.name),
        el("span", { class: "standing-pos" }, `${t.position} / ${FINISH}`)
      )
    );
  });

  placePawns(pawnsLayer, game, game.lastMove ? { [game.lastMove.teamId]: game.lastMove.from } : null);

  let cancelled = false;
  const startBtn = root.querySelector("#start-round");
  startBtn.addEventListener("click", () => {
    if (unusedCount(game) < 5) {
      toast("Not enough unused words left. Add a pack or custom words in a new game.");
      return;
    }
    try {
      dealRound(game);
      state.saveGame(game);
      navigate("round");
    } catch (err) {
      toast(err.message || "Could not deal a card");
    }
  });

  root.querySelector("#quit-game").addEventListener("click", () => {
    if (!confirmAction("Quit this game? Progress will be lost.")) return;
    state.clearGame();
    navigate("home");
  });

  async function runMoveAnim() {
    const move = game.lastMove;
    if (!move || move.to === move.from) {
      game.lastMove = null;
      state.saveGame(game);
      if (game.over) navigate("end");
      return;
    }
    startBtn.disabled = true;
    for (let p = move.from + 1; p <= move.to; p++) {
      if (cancelled) return;
      placePawns(pawnsLayer, game, { [move.teamId]: p });
      sound.play("move");
      if (CHECKPOINT_IDX.has(p)) pulseCheckpoint(svg, p);
      await sleep(160);
    }
    game.lastMove = null;
    state.saveGame(game);
    startBtn.disabled = false;
    if (game.over) {
      await sleep(400);
      if (!cancelled) navigate("end");
    }
  }

  runMoveAnim();
  return () => {
    cancelled = true;
  };
}

function placePawns(layer, game, overridePos) {
  layer.replaceChildren();
  const bySpace = new Map();
  game.teams.forEach((t, idx) => {
    const pos = overridePos && overridePos[t.id] != null ? overridePos[t.id] : t.position;
    if (!bySpace.has(pos)) bySpace.set(pos, []);
    bySpace.get(pos).push({ t, idx });
  });
  bySpace.forEach((group, pos) => {
    const c = COORDS[pos] || COORDS[0];
    group.forEach((item, i) => {
      const pal = paletteFor(item.t.color);
      const dx = (i - (group.length - 1) / 2) * 16;
      const g = elNS("g", {
        transform: `translate(${(c.x + dx).toFixed(1)} ${(c.y - 6).toFixed(1)})`,
        class: "pawn",
      });
      const circle = elNS("circle", {
        r: "14",
        fill: pal.hex,
        stroke: "#2a1f14",
        "stroke-width": "2.5",
      });
      const stem = elNS("path", {
        d: "M -4 10 Q 0 22 4 10",
        fill: pal.hex,
        stroke: "#2a1f14",
        "stroke-width": "2",
      });
      g.appendChild(stem);
      g.appendChild(circle);
      layer.appendChild(g);
    });
  });
}

function drawDefs() {
  const defs = elNS("defs", {});
  const sky = elNS("linearGradient", { id: "skyGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
  sky.appendChild(elNS("stop", { offset: "0%", class: "sky-stop-top" }));
  sky.appendChild(elNS("stop", { offset: "55%", class: "sky-stop-mid" }));
  sky.appendChild(elNS("stop", { offset: "100%", class: "sky-stop-bottom" }));
  defs.appendChild(sky);

  const glow = elNS("radialGradient", { id: "sunGlow" });
  glow.appendChild(elNS("stop", { offset: "0%", class: "glow-stop-in" }));
  glow.appendChild(elNS("stop", { offset: "100%", class: "glow-stop-out" }));
  defs.appendChild(glow);
  return defs;
}

function drawBackdrop() {
  const g = elNS("g", { class: "backdrop" });
  g.appendChild(
    elNS("rect", { x: "0", y: "0", width: String(VIEW_W), height: String(VIEW_H), class: "sky", fill: "url(#skyGrad)" })
  );
  g.appendChild(elNS("circle", { cx: "760", cy: "120", r: "180", class: "sun", fill: "url(#sunGlow)" }));

  // distant hill layers, back to front
  g.appendChild(elNS("ellipse", { cx: "150", cy: "220", rx: "340", ry: "120", class: "hill hill-far" }));
  g.appendChild(elNS("ellipse", { cx: "820", cy: "240", rx: "360", ry: "130", class: "hill hill-far" }));
  g.appendChild(elNS("ellipse", { cx: "500", cy: "560", rx: "620", ry: "150", class: "hill hill-c" }));
  g.appendChild(elNS("ellipse", { cx: "150", cy: "560", rx: "320", ry: "110", class: "hill hill-a" }));
  g.appendChild(elNS("ellipse", { cx: "820", cy: "560", rx: "340", ry: "120", class: "hill hill-b" }));

  // background cypress trees along the horizon
  g.appendChild(cypress(46, 150, 0.6));
  g.appendChild(cypress(94, 162, 0.5));
  g.appendChild(cypress(918, 158, 0.55));
  g.appendChild(cypress(962, 170, 0.45));

  // repeating vineyard rows sitting behind the trail, fanning toward the hills
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const x = 60 + i * ((VIEW_W - 120) / (rows - 1));
    const sway = Math.sin(i * 0.9) * 14;
    g.appendChild(
      elNS("path", {
        d: `M ${x - 6} 500 C ${x + sway - 4} 430, ${x - sway + 6} 360, ${x} 300`,
        class: "vine",
      })
    );
    for (let leaf = 0; leaf < 3; leaf++) {
      const ly = 470 - leaf * 70;
      g.appendChild(elNS("circle", { cx: (x + (leaf % 2 ? 6 : -6)).toFixed(1), cy: String(ly), r: "5", class: "leaf-dot" }));
    }
  }

  // a couple of loose grape clusters filling gaps in the scenery
  g.appendChild(grapes(150, 470, 0.7));
  g.appendChild(grapes(872, 460, 0.7));

  // foreground cypress trees framing the bottom corners
  g.appendChild(cypress(34, 470, 1));
  g.appendChild(cypress(966, 480, 0.95));

  return g;
}

function cypress(x, y, scale = 1) {
  const g = elNS("g", { transform: `translate(${x} ${y}) scale(${scale})`, class: "cypress" });
  g.appendChild(elNS("rect", { x: "-3", y: "0", width: "6", height: "16", class: "cypress-trunk" }));
  g.appendChild(
    elNS("path", {
      d: "M 0 -78 C 16 -60, 16 -30, 10 0 L -10 0 C -16 -30, -16 -60, 0 -78 Z",
      class: "cypress-leaf",
    })
  );
  return g;
}

function drawPath() {
  const g = elNS("g", { class: "track" });
  const d = pathD(COORDS);
  g.appendChild(elNS("path", { d, class: "dirt-wide" }));
  g.appendChild(elNS("path", { d, class: "dirt-core" }));
  return g;
}

function drawSpaces() {
  const g = elNS("g", { class: "spaces" });
  COORDS.forEach((c, i) => {
    const isCheckpoint = CHECKPOINT_IDX.has(i);
    let cls = c.isStart ? "space start" : c.isFinish ? "space finish" : i % 2 ? "space alt" : "space";
    if (isCheckpoint) cls += " checkpoint";
    const attrs = {
      cx: c.x.toFixed(1),
      cy: c.y.toFixed(1),
      r: isCheckpoint ? "19" : "16",
      class: cls,
    };
    if (isCheckpoint) attrs["data-checkpoint"] = String(i);
    g.appendChild(elNS("circle", attrs));
    if (isCheckpoint || i % 5 === 0) {
      g.appendChild(
        elNS(
          "text",
          {
            x: c.x.toFixed(1),
            y: (c.y + 4).toFixed(1),
            class: c.isFinish ? "space-num on-dark" : "space-num",
            "text-anchor": "middle",
          },
          String(i)
        )
      );
    }
  });
  return g;
}

function drawLandmarks() {
  const g = elNS("g", { class: "landmarks" });
  const byIdx = (idx) => CHECKPOINTS.find((c) => c.idx === idx);

  g.appendChild(drawCellar(COORDS[byIdx(0).idx], byIdx(0)));
  g.appendChild(drawPour(COORDS[byIdx(9).idx], byIdx(9)));
  g.appendChild(drawTerrace(COORDS[byIdx(18).idx], byIdx(18)));
  g.appendChild(drawLastCall(COORDS[byIdx(27).idx], byIdx(27)));
  g.appendChild(drawChateau(COORDS[FINISH], byIdx(FINISH)));

  // a couple of loose grape clusters as pure trail-side filler
  g.appendChild(grapes(COORDS[4].x + 38, COORDS[4].y - 20, 0.8));
  g.appendChild(grapes(COORDS[31].x - 40, COORDS[31].y + 24, 0.8));

  return g;
}

function checkpointLabel(x, y, text, idx) {
  return elNS(
    "text",
    { x: x.toFixed(1), y: y.toFixed(1), class: "label", "text-anchor": "middle", "data-checkpoint": String(idx) },
    text
  );
}

function drawCellar(pt, meta) {
  const g = elNS("g", { class: "station station-cellar", "data-checkpoint": String(meta.idx) });
  g.appendChild(barrel(pt.x - 44, pt.y + 26));
  g.appendChild(barrel(pt.x - 20, pt.y + 32));
  g.appendChild(barrel(pt.x - 32, pt.y + 8));
  g.appendChild(checkpointLabel(pt.x - 32, pt.y + 64, meta.label, meta.idx));
  return g;
}

function drawPour(pt, meta) {
  const g = elNS("g", { class: "station station-pour", "data-checkpoint": String(meta.idx) });
  const bx = pt.x + 30;
  const by = pt.y - 30;
  g.appendChild(elNS("rect", { x: bx - 3, y: by - 26, width: "6", height: "26", rx: "2", class: "bottle" }));
  g.appendChild(elNS("rect", { x: bx - 5, y: by - 32, width: "10", height: "8", rx: "2", class: "bottle-neck" }));
  g.appendChild(clinkGlass(bx - 20, by - 4, -8));
  g.appendChild(clinkGlass(bx + 18, by - 4, 8));
  g.appendChild(checkpointLabel(bx, by + 26, meta.label, meta.idx));
  return g;
}

function clinkGlass(x, y, tilt) {
  const g = elNS("g", { transform: `translate(${x} ${y}) rotate(${tilt})`, class: "glass-group" });
  g.appendChild(elNS("path", { d: "M -7 -18 L 7 -18 L 3 0 L -3 0 Z", class: "glass" }));
  g.appendChild(elNS("line", { x1: "0", y1: "0", x2: "0", y2: "8", class: "glass-stem" }));
  g.appendChild(elNS("line", { x1: "-6", y1: "8", x2: "6", y2: "8", class: "glass-stem" }));
  return g;
}

function drawTerrace(pt, meta) {
  const g = elNS("g", { class: "station station-terrace", "data-checkpoint": String(meta.idx) });
  const tx = pt.x - 34;
  const ty = pt.y - 34;
  g.appendChild(elNS("line", { x1: tx, y1: ty - 40, x2: tx, y2: ty - 6, class: "umbrella-pole" }));
  g.appendChild(
    elNS("path", { d: `M ${tx - 26} ${ty - 40} Q ${tx} ${ty - 62} ${tx + 26} ${ty - 40} Z`, class: "umbrella" })
  );
  g.appendChild(elNS("rect", { x: tx - 22, y: ty - 6, width: "44", height: "12", rx: "3", class: "table" }));
  g.appendChild(elNS("rect", { x: tx - 18, y: ty + 6, width: "4", height: "10", class: "table-leg" }));
  g.appendChild(elNS("rect", { x: tx + 14, y: ty + 6, width: "4", height: "10", class: "table-leg" }));
  g.appendChild(elNS("circle", { cx: tx - 6, cy: ty - 10, r: "4", class: "glass" }));
  g.appendChild(elNS("circle", { cx: tx + 6, cy: ty - 10, r: "4", class: "glass" }));
  g.appendChild(checkpointLabel(tx, ty + 34, meta.label, meta.idx));
  return g;
}

function drawLastCall(pt, meta) {
  const g = elNS("g", { class: "station station-lastcall", "data-checkpoint": String(meta.idx) });
  const lx = pt.x + 34;
  const ly = pt.y - 20;
  g.appendChild(barrel(lx, ly + 20));
  g.appendChild(elNS("line", { x1: lx - 16, y1: ly - 6, x2: lx - 16, y2: ly - 34, class: "lantern-pole" }));
  g.appendChild(elNS("circle", { cx: lx - 16, cy: ly - 40, r: "9", class: "lantern-glow" }));
  g.appendChild(elNS("rect", { x: lx - 22, y: ly - 46, width: "12", height: "14", rx: "3", class: "lantern" }));
  g.appendChild(checkpointLabel(lx - 16, ly + 46, meta.label, meta.idx));
  return g;
}

function drawChateau(pt, meta) {
  const g = elNS("g", { class: "station station-chateau", "data-checkpoint": String(meta.idx) });
  const cx = pt.x + 10;
  const cy = pt.y - 60;
  const groundY = cy + 38;
  g.appendChild(
    elNS("path", {
      d: `M ${cx - 44} ${groundY} C ${cx - 40} ${groundY - 24}, ${cx - 34} ${groundY - 44}, ${cx - 30} ${groundY - 54}`,
      class: "vine-trellis",
    })
  );
  g.appendChild(elNS("rect", { x: cx - 30, y: cy, width: "60", height: "38", class: "chateau" }));
  g.appendChild(elNS("polygon", { points: `${cx - 34},${cy} ${cx},${cy - 24} ${cx + 34},${cy}`, class: "roof" }));
  g.appendChild(elNS("rect", { x: cx - 10, y: cy + 14, width: "20", height: "24", class: "door" }));
  g.appendChild(elNS("rect", { x: cx - 24, y: cy + 10, width: "10", height: "10", class: "window" }));
  g.appendChild(elNS("rect", { x: cx + 14, y: cy + 10, width: "10", height: "10", class: "window" }));
  g.appendChild(elNS("rect", { x: cx + 12, y: cy - 36, width: "11", height: "20", class: "turret" }));
  g.appendChild(elNS("polygon", { points: `${cx + 10.5},${cy - 36} ${cx + 17.5},${cy - 50} ${cx + 24.5},${cy - 36}`, class: "roof" }));
  g.appendChild(elNS("path", { d: `M ${cx + 17.5} ${cy - 50} L ${cx + 17.5} ${cy - 60} L ${cx + 27} ${cy - 55} Z`, class: "flag" }));
  g.appendChild(checkpointLabel(cx, cy + 56, meta.label, meta.idx));
  return g;
}

function barrel(x, y) {
  const g = elNS("g", { transform: `translate(${x} ${y})`, class: "barrel-group" });
  g.appendChild(elNS("ellipse", { cx: "0", cy: "0", rx: "12", ry: "16", class: "barrel" }));
  g.appendChild(elNS("line", { x1: "-12", y1: "-4", x2: "12", y2: "-4", class: "barrel-ring" }));
  g.appendChild(elNS("line", { x1: "-12", y1: "4", x2: "12", y2: "4", class: "barrel-ring" }));
  return g;
}

function grapes(x, y, scale = 1) {
  const g = elNS("g", { transform: `translate(${x} ${y}) scale(${scale})`, class: "grapes" });
  const pts = [
    [0, 0],
    [-8, 8],
    [8, 8],
    [-4, 16],
    [4, 16],
    [0, 24],
  ];
  pts.forEach(([px, py]) => g.appendChild(elNS("circle", { cx: px, cy: py, r: "6" })));
  g.appendChild(elNS("path", { d: "M 0 0 C -4 -14, 10 -16, 8 -8", class: "vine" }));
  return g;
}

function pulseCheckpoint(svg, idx) {
  const nodes = svg.querySelectorAll(`[data-checkpoint="${idx}"]`);
  nodes.forEach((n) => {
    n.classList.remove("pulse");
    if (typeof n.getBBox === "function") n.getBBox();
    n.classList.add("pulse");
    setTimeout(() => n.classList.remove("pulse"), 700);
  });
}

function elNS(tag, attrs = {}, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.setAttribute("class", v);
    else node.setAttribute(k, String(v));
  }
  children.flat().forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}
