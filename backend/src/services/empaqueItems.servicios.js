import { readFileSync } from "fs";
import path from "path";
import itemsModel from "../models/items.models";

const csvPath = () =>
  path.resolve(__dirname, "../../data/empaques-items.csv");

const clave = (valor) => String(valor || "").trim().toUpperCase();

const entero = (valor) => {
  const n = Number(String(valor ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
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

export const frioDeSiesa = (element = {}) =>
  String(
    element.estado_frio ||
      element.estadoFrio ||
      element.Estado_frio ||
      element.frio ||
      ""
  )
    .trim()
    .toUpperCase();

export const aliasTara = (nombre) => {
  const n = clave(nombre);
  if (n === "DOBLE CANASTILLA") return "CANASTILLA";
  return n;
};

export const leerEmpaquesCsv = () => {
  const crudo = readFileSync(csvPath(), "utf8").replace(/^\uFEFF/, "");
  const lineas = crudo.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const filas = [];
  for (const line of lineas.slice(1)) {
    const cols = parsearLineaCsv(line);
    const referencia = String(cols[1] || "").trim();
    if (!referencia) continue;
    filas.push({
      idExterno: String(cols[0] || "").trim(),
      referencia,
      descripcion: String(cols[2] || "").trim(),
      unidadesEmpaqueMax: entero(cols[3]),
      unidadesEmpaque: entero(cols[4]),
      estadoFrio: String(cols[5] || "").trim().toUpperCase(),
      taraNombre: String(cols[7] || "").trim().toUpperCase(),
    });
  }
  return filas;
};

const ponerClaves = (mapa, valor, id) => {
  const k = clave(valor);
  if (!k) return;
  mapa.set(k, id);
  if (k.startsWith("E") && k.length > 1) mapa.set(k.slice(1), id);
  else mapa.set(`E${k}`, id);
};

export const aplicarEmpaquesAItems = async () => {
  const filas = leerEmpaquesCsv();
  const items = await itemsModel
    .find(
      {},
      {
        referencia: 1,
        codigoItem: 1,
        item: 1,
        estadoFrio: 1,
        taraNombre: 1,
        unidadesEmpaque: 1,
        unidadesEmpaqueMax: 1,
        logisticaLocal: 1,
      }
    )
    .lean();
  const porRef = new Map();
  const porItem = new Map();
  const porId = new Map();
  for (const it of items) {
    porId.set(String(it._id), it);
    ponerClaves(porRef, it.referencia, it._id);
    ponerClaves(porRef, it.codigoItem, it._id);
    if (it.item) porItem.set(String(it.item).trim(), it._id);
  }

  const ops = [];
  const usados = new Set();
  let sinMatch = 0;
  let omitidos = 0;
  for (const fila of filas) {
    const id =
      porRef.get(clave(fila.referencia)) ||
      porRef.get(clave(`E${fila.referencia}`)) ||
      porItem.get(String(fila.idExterno));
    if (!id || usados.has(String(id))) {
      if (!id) sinMatch += 1;
      continue;
    }
    usados.add(String(id));
    const actual = porId.get(String(id));
    if (actual?.logisticaLocal) {
      omitidos += 1;
      continue;
    }
    const set = { fecha_actualizacion: new Date() };
    if (!String(actual?.taraNombre || "").trim() && fila.taraNombre) {
      set.taraNombre = fila.taraNombre;
    }
    if (!(Number(actual?.unidadesEmpaque) > 0) && fila.unidadesEmpaque > 0) {
      set.unidadesEmpaque = fila.unidadesEmpaque;
    }
    if (!(Number(actual?.unidadesEmpaqueMax) > 0) && fila.unidadesEmpaqueMax > 0) {
      set.unidadesEmpaqueMax = fila.unidadesEmpaqueMax;
    }
    const frioActual = clave(actual?.estadoFrio);
    if ((!frioActual || frioActual === "SIN ASIGNAR") && fila.estadoFrio) {
      set.estadoFrio = fila.estadoFrio;
    }
    if (Object.keys(set).length <= 1) {
      omitidos += 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: id },
        update: { $set: set },
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

export default {
  frioDeSiesa,
  aliasTara,
  leerEmpaquesCsv,
  aplicarEmpaquesAItems,
};
