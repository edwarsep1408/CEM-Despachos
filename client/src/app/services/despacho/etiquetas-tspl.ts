/** TSPL2 para TSC MH241T — plantilla hija BarTender 304 × 60 mm (SIZE 58.7 mm, 304 mm). */

const ENC = new TextEncoder();

const PREAMBULO = [
  "SIZE 58.7 mm, 304 mm",
  "GAP 3 mm, 0 mm",
  "SPEED 8",
  "DENSITY 8",
  "SET RIBBON ON",
  "DIRECTION 0,0",
  "REFERENCE 0,0",
  "OFFSET 0 mm",
  "SET REWIND OFF",
  "SET PEEL OFF",
  "SET CUTTER OFF",
  "SET PARTIAL_CUTTER OFF",
  "SET APPLICATOR OFF",
  "SET TEAR ON",
  "CLS",
].join("\r\n");

const escTspl = (value: unknown) =>
  String(value ?? "")
    .replace(/\r|\n/g, " ")
    .replace(/"/g, "'")
    .slice(0, 80);

const concat = (partes: Uint8Array[]) => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

let bitmapCache: Uint8Array | null = null;

export const cargarBitmapPollocoa = async () => {
  if (bitmapCache) return bitmapCache;
  const res = await fetch("/assets/pollocoa-banderin.bin");
  if (!res.ok) return new Uint8Array();
  bitmapCache = new Uint8Array(await res.arrayBuffer());
  return bitmapCache;
};

export type CamposBanderinHija = {
  productLongName: string;
  referencia: string;
  loadName: string;
  stateProduct: string;
  consecutive: string;
  enterpriseClientName: string;
  barcode: string;
};

export const tsplBanderinHija = (campos: CamposBanderinHija, bitmap: Uint8Array) => {
  const partes: Uint8Array[] = [ENC.encode(`${PREAMBULO}\r\n`)];
  if (bitmap.length) {
    partes.push(ENC.encode("BITMAP 152,2060,19,336,1,"));
    partes.push(bitmap);
    partes.push(ENC.encode("\r\n"));
  }
  const qr = escTspl(campos.barcode);
  const nombre = escTspl(campos.productLongName || "SIN CLIENTE");
  const cliente = escTspl(campos.enterpriseClientName || nombre);
  const ref = escTspl(campos.referencia);
  const load = escTspl(campos.loadName);
  const estado = escTspl(campos.stateProduct);
  const consec = escTspl(campos.consecutive);
  const cmds = [
    `QRCODE 332,1783,L,10,A,90,M2,S7,"${qr}"`,
    "CODEPAGE 1252",
    `TEXT 295,959,"0",90,15,16,"Referencia: ${ref}"`,
    `TEXT 242,959,"0",90,15,16,"${load}"`,
    `TEXT 189,959,"0",90,15,16,"${estado}"`,
    `TEXT 136,959,"0",90,15,16,"${consec}"`,
    `TEXT 436,1079,"0",90,35,36,"${nombre}"`,
    `TEXT 59,959,"0",90,15,16,"${cliente}"`,
    "PRINT 1,1",
    "",
  ].join("\r\n");
  partes.push(ENC.encode(cmds));
  return concat(partes);
};

export const descargarPrn = (nombre: string, bytes: Uint8Array) => {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
