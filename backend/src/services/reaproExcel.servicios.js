import xlsx from "xlsx";

const texto = (valor) => String(valor == null ? "" : valor).trim();

const numero = (valor) => {
  if (valor == null || valor === "") return 0;
  const n = Number(String(valor).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const celda = (fila, col) => (Array.isArray(fila) ? fila[col] : undefined);

const incluye = (valor, parte) => texto(valor).toUpperCase().includes(String(parte).toUpperCase());

const hojaFormato = (workbook) => {
  const nombre = (workbook.SheetNames || []).find((n) => texto(n).toUpperCase() === "FORMATO");
  if (!nombre) {
    throw new Error('El Excel debe traer la hoja "FORMATO". Las demás hojas se ignoran.');
  }
  return workbook.Sheets[nombre];
};

const detectarColumnas = (encabezado, sub) => {
  const cols = { referencia: 0, producto: 1, kilos: 3, unidades: 4 };
  (encabezado || []).forEach((valor, i) => {
    if (incluye(valor, "REFERENCIA")) cols.referencia = i;
    if (incluye(valor, "PRODUCTO")) cols.producto = i;
  });
  (sub || []).forEach((valor, i) => {
    if (incluye(valor, "KILO")) cols.kilos = i;
    if (incluye(valor, "UND")) cols.unidades = i;
  });
  return cols;
};

export const parsearExcelReapro = (bufferOPath) => {
  const workbook = Buffer.isBuffer(bufferOPath)
    ? xlsx.read(bufferOPath, { type: "buffer", cellDates: true })
    : xlsx.readFile(bufferOPath, { cellDates: true });
  const sheet = hojaFormato(workbook);
  const filas = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  if (!filas.length) throw new Error("La hoja FORMATO está vacía.");

  const cedi = texto(celda(filas[0], 0));
  if (!cedi) throw new Error("En A1 de FORMATO debe ir el CEDIS (ej. CEDI NORTE).");

  const idxEncabezado = filas.findIndex((fila) => incluye(celda(fila, 0), "REFERENCIA"));
  if (idxEncabezado < 0) {
    throw new Error('No se encontró la fila de encabezados (REFERENCIA / PRODUCTO) en FORMATO.');
  }

  const encabezado = filas[idxEncabezado] || [];
  let inicio = idxEncabezado + 1;
  let sub = [];
  const siguiente = filas[inicio] || [];
  if (incluye(celda(siguiente, 3), "KILO") || incluye(celda(siguiente, 4), "UND") || incluye(celda(siguiente, 3), "UND")) {
    sub = siguiente;
    inicio += 1;
  }
  const cols = detectarColumnas(encabezado, sub);

  const lineas = [];
  for (let i = inicio; i < filas.length; i += 1) {
    const fila = filas[i] || [];
    const referencia = texto(celda(fila, cols.referencia));
    if (!referencia) continue;
    const kilos = Number(numero(celda(fila, cols.kilos)).toFixed(3));
    const unidades = Number(numero(celda(fila, cols.unidades)).toFixed(3));
    if (kilos <= 0 && unidades <= 0) continue;
    lineas.push({
      referencia,
      descripcion: texto(celda(fila, cols.producto)),
      kilos,
      unidades,
    });
  }

  if (!lineas.length) {
    throw new Error("FORMATO no tiene líneas con kilos o unidades para despachar.");
  }

  return { cedi, lineas };
};
