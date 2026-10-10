import QRCode from "qrcode";
import "./share-game.css";

/** Comparte la portada, nunca el nombre, la partida ni parámetros de depuración. */
export function shareUrl(href) {
  const current = new URL(href);
  const url = new URL(current.pathname, current.origin);
  const server = current.searchParams.get("server");
  if (server) url.searchParams.set("server", server);
  return url.href;
}

export function mountShareGame({ onOpen, onClose }) {
  const root = document.createElement("div");
  root.id = "share-game";
  root.innerHTML = `
    <button class="share-trigger" type="button">QR · Invitar</button>
    <dialog aria-labelledby="share-title">
      <button class="share-close" aria-label="Cerrar QR" type="button">×</button>
      <h2 id="share-title">Lleva Stones a tu celular</h2>
      <p>Escanea con la cámara para abrir el juego.</p>
      <canvas aria-label="Código QR para abrir Stones"></canvas>
      <a class="share-link" target="_blank" rel="noopener"></a>
      <p class="share-local" hidden>Este enlace es local. Abre la versión pública para invitar desde otro celular.</p>
      <p>Para guardarlo en tu celular, toca <strong>Instalar aplicación</strong> en el menú del juego. En iPhone: Compartir → Agregar a inicio.</p>
    </dialog>`;
  document.body.append(root);
  const dialog = root.querySelector("dialog");
  const trigger = root.querySelector(".share-trigger");
  const link = root.querySelector("a");
  const url = shareUrl(location.href);
  link.href = url;
  link.textContent = url;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  root.querySelector(".share-local").hidden = !local;
  const canvas = root.querySelector("canvas");
  QRCode.toCanvas(canvas, url, {
    width: 224, margin: 4, errorCorrectionLevel: "M",
    color: { dark: "#120e17", light: "#ffffff" },
  }).then(() => {
    // La biblioteca fija el tamaño en línea; el CSS adapta la vista horizontal del celular.
    canvas.style.width = "";
    canvas.style.height = "";
  }).catch(() => {
    root.querySelector("canvas").hidden = true;
    root.querySelector("p").textContent = "Abre o copia este enlace para compartir el juego.";
  });
  trigger.addEventListener("click", () => {
    onOpen();
    dialog.showModal();
  });
  root.querySelector(".share-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { onClose(); trigger.focus(); });
  return () => root.remove();
}
