import { encodeKeyPayload } from "./game.js";
import { el } from "./ui.js";

let escHandler = null;
let backdropHandler = null;

function backdrop() {
  return document.getElementById("info-modal");
}

export function openInfoModal(game) {
  const modal = backdrop();
  if (!modal || !game) return;

  // ----- QR -----
  const qrTarget = modal.querySelector("#info-qr");
  qrTarget.innerHTML = "";
  const url = `${location.origin}${location.pathname}#key=${encodeKeyPayload(game)}`;
  try {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    qrTarget.innerHTML = qr.createImgTag(4, 12);
  } catch {
    qrTarget.appendChild(el("p", { class: "muted" }, "Couldn't render QR — use the link below."));
  }
  const link = modal.querySelector("#info-qr-link");
  link.href = url;
  link.textContent = url;

  // ----- Teams -----
  const redUl = modal.querySelector("#info-red");
  const blueUl = modal.querySelector("#info-blue");
  redUl.innerHTML = "";
  blueUl.innerHTML = "";
  const fill = (ul, list, spy) => {
    list.forEach((p) => {
      const isSpy = p === spy;
      ul.appendChild(
        el(
          "li",
          { class: isSpy ? "spymaster" : "" },
          isSpy ? el("span", { class: "spy-mark", title: "Spymaster" }, "★") : null,
          p
        )
      );
    });
    if (!list.length) ul.appendChild(el("li", { class: "muted" }, "—"));
  };
  fill(redUl, game.teams?.red || [], game.spymasters?.red);
  fill(blueUl, game.teams?.blue || [], game.spymasters?.blue);

  // ----- Show -----
  modal.classList.remove("hidden");

  escHandler = (e) => {
    if (e.key === "Escape") closeInfoModal();
  };
  backdropHandler = (e) => {
    if (e.target === modal) closeInfoModal();
  };
  modal.querySelector('[data-action="close-info"]').onclick = closeInfoModal;
  document.addEventListener("keydown", escHandler);
  modal.addEventListener("click", backdropHandler);
}

export function closeInfoModal() {
  const modal = backdrop();
  if (!modal) return;
  modal.classList.add("hidden");
  if (escHandler) document.removeEventListener("keydown", escHandler);
  if (backdropHandler) modal.removeEventListener("click", backdropHandler);
  escHandler = null;
  backdropHandler = null;
}
