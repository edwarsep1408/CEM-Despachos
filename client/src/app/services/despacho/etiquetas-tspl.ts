/** TSPL2 TSC MH241T — plantillas BarTender 22/07/2026 (304 × 60 mm). */

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

const cacheBitmap: Record<string, Uint8Array> = {};

const cargarBitmap = async (nombre: "hija" | "padre") => {
  if (cacheBitmap[nombre]) return cacheBitmap[nombre];
  const res = await fetch(`/assets/pollocoa-banderin-${nombre}.bin`);
  if (!res.ok) return new Uint8Array();
  cacheBitmap[nombre] = new Uint8Array(await res.arrayBuffer());
  return cacheBitmap[nombre];
};

/** @deprecated usar cargarBitmapHija */
export const cargarBitmapPollocoa = () => cargarBitmap("hija");

export const cargarBitmapHija = () => cargarBitmap("hija");
export const cargarBitmapPadre = () => cargarBitmap("padre");

export type CamposBanderinHija = {
  productLongName: string;
  referencia: string;
  loadName: string;
  stateProduct: string;
  consecutive: string;
  enterpriseClientName: string;
  barcode: string;
};

export type CamposBanderinPadre = {
  productLongName: string;
  enterpriseClientName: string;
  barcodeFather: string;
  barcodePrintStart: string;
  barcodePrintEnd: string;
  quantity: string | number;
  date: string;
};

/** Etiqueta hija (1 por canasta) — plantilla_etiquetahija22072026.prn */
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

/** Etiqueta padre (resumen del lote) — plantilla_etiquetapadre_22072026.prn */
export const tsplBanderinPadre = (campos: CamposBanderinPadre, bitmap: Uint8Array) => {
  const partes: Uint8Array[] = [ENC.encode(`${PREAMBULO}\r\n`)];
  if (bitmap.length) {
    partes.push(ENC.encode("BITMAP 159,2125,15,264,1,"));
    partes.push(bitmap);
    partes.push(ENC.encode("\r\n"));
  }
  const qr = escTspl(campos.barcodeFather);
  const nombre = escTspl(campos.productLongName || "SIN CLIENTE");
  const cliente = escTspl(campos.enterpriseClientName || nombre);
  const inicio = escTspl(campos.barcodePrintStart);
  const fin = escTspl(campos.barcodePrintEnd);
  const cant = escTspl(campos.quantity);
  const fecha = escTspl(campos.date);
  const cmds = [
    `QRCODE 270,959,L,10,A,90,M2,S7,"${qr}"`,
    "CODEPAGE 1252",
    `TEXT 280,1279,"0",90,15,16,"Inicio: ${inicio}"`,
    `TEXT 227,1279,"0",90,15,16,"Fin:  ${fin}"`,
    `TEXT 174,1279,"0",90,15,16,"Cantidad: ${cant}"`,
    `TEXT 121,1279,"0",90,15,16,"Fecha: ${fecha}"`,
    `TEXT 68,1279,"0",90,15,16,"Cliente: ${cliente}"`,
    `TEXT 416,1039,"0",90,35,36,"${nombre}"`,
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
