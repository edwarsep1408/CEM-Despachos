import { readFileSync } from "fs";
import path from "path";
import moment from "moment-timezone";
import itemsModel from "../models/items.models";

const ZONA = "America/Bogota";

const csvPath = () =>
  path.resolve(__dirname, "../../data/vidas-utiles.csv");

const clave = (valor) => String(valor || "").trim().toUpperCase();

const entero = (valor) => {
  const n = Number(String(valor ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const parsearLineaCsv = (line) => {
  const out = [];
  let cur = "";
  let enComillas = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      enComillas = !enComillas;
      continue;
    }
    if (c === ";" && !enComillas) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
};

export const etiquetaVidaUtil = (meses, dias) => {
  const partes = [];
  if (meses > 0) partes.push(meses === 1 ? "1 mes" : `${meses} meses`);
  if (dias > 0) partes.push(dias === 1 ? "1 día" : `${dias} días`);
  return partes.join(" y ");
};

export const fechaVencimientoDe = (meses = 0, dias = 0, desde) => {
  if (!(meses > 0) && !(dias > 0)) return "";
  if (!desde) return "";
  let m = moment.tz(desde, ZONA);
  if (!m.isValid()) m = moment.tz(String(desde), ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY"], true, ZONA);
  if (!m.isValid()) return "";
  m = m.startOf("day");
  if (meses > 0) m = m.add(meses, "months");
  if (dias > 0) m = m.add(dias, "days");
  return m.format("YYYY-MM-DD");
};

export const parsearFechaLote = (lote) => {
  const s = String(lote || "").trim();
  if (!s || s === "0") return "";
  const formatos = [
    "YYYY-MM-DD",
    "DD/MM/YYYY",
    "DD-MM-YYYY",
    "YYYYMMDD",
    "DDMMYYYY",
    "YYMMDD",
    "DDMMYY",
  ];
  const hoy = moment.tz(ZONA).startOf("day");
  const validos = [];
  for (const formato of formatos) {
    const m = moment.tz(s, formato, true, ZONA);
    if (m.isValid()) validos.push(m.clone().startOf("day"));
  }
  if (!validos.length) return "";
  const pasados = validos.filter((m) => m.isSameOrBefore(hoy));
  const elegido = (pasados.length ? pasados : validos).sort((a, b) => b.valueOf() - a.valueOf())[0];
  return elegido.format("YYYY-MM-DD");
};

export const leerVidasUtilesCsv = () => {
  const crudo = readFileSync(csvPath(), "utf8").replace(/^\uFEFF/, "");
  const lineas = crudo.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const filas = [];
  for (const line of lineas.slice(1)) {
    const cols = parsearLineaCsv(line);
    const referencia = String(cols[1] || "").trim();
    if (!referencia) continue;
    const meses = entero(cols[3]);
    const dias = entero(cols[4]);
    filas.push({
      referencia,
      descripcion: String(cols[2] || "").trim(),
      meses,
      dias,
      idPro: String(cols[5] || "").trim(),
      etiqueta: etiquetaVidaUtil(meses, dias),
    });
  }
  return filas;
};

export const aplicarVidasUtilesAItems = async () => {
  const filas = leerVidasUtilesCsv();
  const items = await itemsModel
    .find({}, { referencia: 1, codigoItem: 1, item: 1, vidaUtilMeses: 1, vidaUtilDias: 1, logisticaLocal: 1 })
    .lean();
  const porRef = new Map();
  const porItem = new Map();
  const porId = new Map();
  for (const it of items) {
    porId.set(String(it._id), it);
    if (it.referencia) porRef.set(clave(it.referencia), it._id);
    if (it.codigoItem) porRef.set(clave(it.codigoItem), it._id);
    if (it.item) porItem.set(String(it.item).trim(), it._id);
  }

  const ops = [];
  const usados = new Set();
  let sinMatch = 0;
  let omitidos = 0;
  for (const fila of filas) {
    const id =
      porRef.get(clave(fila.referencia)) || porItem.get(String(fila.idPro));
    if (!id || usados.has(String(id))) {
      if (!id) sinMatch += 1;
      continue;
    }
    usados.add(String(id));
    const actual = porId.get(String(id));
    const tieneVida =
      Number(actual?.vidaUtilMeses) > 0 || Number(actual?.vidaUtilDias) > 0;
    if (actual?.logisticaLocal || tieneVida) {
      omitidos += 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            vidaUtilMeses: fila.meses,
            vidaUtilDias: fila.dias,
            vidaUtilEtiqueta: fila.etiqueta,
            fecha_actualizacion: new Date(),
          },
        },
      },
    });
  }
  if (ops.length) await itemsModel.bulkWrite(ops);
  return {
    filasCsv: filas.length,
    actualizados: ops.length,
    omitidos,
    sinMatch,
  };
};

const ponerClavesItem = (mapa, valor, it) => {
  const k = clave(valor);
  if (!k) return;
  mapa.set(k, it);
  if (k.startsWith("E") && k.length > 1) mapa.set(k.slice(1), it);
  else mapa.set(`E${k}`, it);
};

export const enriquecerLineasVidaUtil = async (lineas = []) => {
  const lista = Array.isArray(lineas) ? lineas : [];
  if (!lista.length) return lista;
  const items = await itemsModel
    .find(
      {},
      {
        referencia: 1,
        codigoItem: 1,
        item: 1,
        vidaUtilMeses: 1,
        vidaUtilDias: 1,
        vidaUtilEtiqueta: 1,
        unidadesEmpaque: 1,
        unidadesEmpaqueMax: 1,
        taraNombre: 1,
        estadoFrio: 1,
      }
    )
    .lean();
  const mapa = new Map();
  for (const it of items) {
    ponerClavesItem(mapa, it.referencia, it);
    ponerClavesItem(mapa, it.codigoItem, it);
    ponerClavesItem(mapa, it.item, it);
  }
  return lista.map((linea) => {
    const it =
      mapa.get(clave(linea.codigo)) ||
      mapa.get(clave(linea.referencia)) ||
      mapa.get(clave(linea.codigoItem));
    const meses = Number(it?.vidaUtilMeses) || 0;
    const dias = Number(it?.vidaUtilDias) || 0;
    return {
      ...linea,
      vidaUtilMeses: meses,
      vidaUtilDias: dias,
      vidaUtilEtiqueta: it?.vidaUtilEtiqueta || etiquetaVidaUtil(meses, dias),
      unidadesEmpaque: Number(it?.unidadesEmpaque) || 0,
      unidadesEmpaqueMax: Number(it?.unidadesEmpaqueMax) || 0,
      taraNombre: String(it?.taraNombre || "").trim(),
      estadoFrio: String(it?.estadoFrio || "").trim(),
    };
  });
};

export const vidaUtilDeProducto = async (linea = {}) => {
  let meses = Number(linea.vidaUtilMeses) || 0;
  let dias = Number(linea.vidaUtilDias) || 0;
  if (meses || dias) return { meses, dias };
  const keys = [linea.codigo, linea.referencia, linea.codigoItem]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!keys.length) return { meses: 0, dias: 0 };
  const it = await itemsModel
    .findOne({
      $or: [
        { referencia: { $in: keys } },
        { codigoItem: { $in: keys } },
        { item: { $in: keys } },
      ],
    })
    .lean();
  return {
    meses: Number(it?.vidaUtilMeses) || 0,
    dias: Number(it?.vidaUtilDias) || 0,
  };
};

export const enriquecerDocumentosVidaUtil = async (documentos = []) => {
  const docs = Array.isArray(documentos) ? documentos : [];
  const planas = docs.flatMap((doc) => doc.lineas || []);
  const enriquecidas = await enriquecerLineasVidaUtil(planas);
  let i = 0;
  return docs.map((doc) => ({
    ...doc,
    lineas: (doc.lineas || []).map(() => enriquecidas[i++]),
  }));
};

export default {
  etiquetaVidaUtil,
  parsearFechaLote,
  fechaVencimientoDe,
  vidaUtilDeProducto,
  leerVidasUtilesCsv,
  aplicarVidasUtilesAItems,
  enriquecerLineasVidaUtil,
  enriquecerDocumentosVidaUtil,
};
