import QRCode from "qrcode";

export const qrSvg = (text: string) => {
  const qr = QRCode.create(text || " ", { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 2;
  const view = size + quiet * 2;
  const rects: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!qr.modules.get(x, y)) continue;
      rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
};
