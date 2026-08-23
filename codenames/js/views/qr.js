import { template, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { encodeKeyPayload } from "../game.js";

function buildKeyUrl(payload) {
  // Use absolute URL so QR works when scanned from another device.
  const base = location.origin + location.pathname;
  return `${base}#key=${payload}`;
}

function renderQrInto(target, text) {
  // Use auto type number; Q-level error correction is reasonable for screens.
  // qrcode-generator picks size automatically when typeNumber=0.
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  target.innerHTML = qr.createImgTag(6, 16); // moduleSize, margin
  const img = target.querySelector("img");
  if (img) {
    img.alt = "Spymaster key QR code";
    img.style.width = "min(60vw, 320px)";
    img.style.height = "auto";
    img.style.imageRendering = "pixelated";
  }
}

export function renderQr(root) {
  root.appendChild(template("tpl-qr"));
  const game = state.getGame();
  if (!game) {
    toast("No game in progress");
    navigate("home");
    return;
  }

  const payload = encodeKeyPayload(game);
  const url = buildKeyUrl(payload);

  const target = root.querySelector("#qr-target");
  try {
    renderQrInto(target, url);
  } catch (err) {
    target.textContent = "Couldn't render QR code. Use the link below instead.";
    console.warn(err);
  }

  const link = root.querySelector("#qr-link");
  link.href = url;
  link.textContent = url;

  root.querySelector("#to-play").addEventListener("click", () => navigate("play"));
}
