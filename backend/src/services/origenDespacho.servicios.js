import carguesModel from "../models/cargues.models";
import pedidosModel from "../models/pedidos.models";
import reaproModel from "../models/reaprovisionamientos.models";

const norm = (estado) => String(estado || "").trim().toLowerCase();

const esReapro = (doc) => {
  const tipo = String(doc?.tipo || doc?.tipoDoc || "").toUpperCase();
  return tipo === "REAPRO" || tipo.includes("REAPRO");
};

export const esAprobado = (estado) => norm(estado) === "aprobado";

export const esCumplido = (estado) => norm(estado) === "cumplido";

export const esLogistica = (estado) => {
  const n = norm(estado);
  return (
    n === "despachando" ||
    n === "despachado" ||
    n === "comprometido" ||
    n === "cumplido"
  );
};

const RANGO = {
  elaborado: 1,
  retenido: 2,
  aprobado: 3,
  despachando: 4,
  despachado: 5,
  comprometido: 6,
  cumplido: 7,
};

export const etiquetaEstadoPedido = (estado) => {
  const n = norm(estado);
  if (n === "despachando") return "Despachando";
  if (n === "despachado") return "Despachado";
  if (n === "comprometido") return "Comprometido";
  if (n === "cumplido") return "Cumplido";
  return String(estado || "").trim();
};

const rangoEstado = (estado) => {
  const n = norm(estado);
  if (n === "anulado") return 100;
  return RANGO[n] || 0;
};

export const estadoMasAvanzado = (...estados) => {
  if (estados.some((e) => esCumplido(e))) return "Cumplido";
  let mejor = "";
  let mejorRango = -1;
  for (const estado of estados) {
    const r = rangoEstado(estado);
    if (!r || r >= 100) continue;
    if (r > mejorRango) {
      mejorRango = r;
      mejor = etiquetaEstadoPedido(estado);
    }
  }
  return mejor;
};

export const estadoTrasEtl = (prev, estadoSiesa) => {
  if (esCumplido(estadoSiesa)) {
    return {
      estado: "Cumplido",
      idCargue: prev?.idCargue ?? null,
      compromiso: prev?.compromiso || null,
    };
  }
  if (esLogistica(prev?.estado)) {
    return {
      estado: etiquetaEstadoPedido(prev.estado),
      idCargue: prev?.idCargue ?? null,
      compromiso: prev?.compromiso || null,
    };
  }
  return {
    estado: estadoSiesa || "",
    idCargue: null,
    compromiso: prev?.compromiso || null,
  };
};

const esDespachadoDoc = (doc) =>
  String(doc?.estadoDespacho || "").toUpperCase() === "DESP";

const idEncsDe = (documentos, pred) =>
  (Array.isArray(documentos) ? documentos : [])
    .filter(pred)
    .map((doc) => String(doc.idEnc || "").trim())
    .filter(Boolean);

export const mapaCarguesActivos = async () => {
  const cargues = await carguesModel
    .find(
      { estado: { $in: ["pendiente", "enviado"] } },
      { idCargue: 1, documentos: 1 }
    )
    .lean();
  const mapa = new Map();
  for (const cargue of cargues) {
    for (const doc of cargue.documentos || []) {
      const idEnc = String(doc.idEnc || "").trim();
      if (!idEnc) continue;
      mapa.set(idEnc, {
        idCargue: cargue.idCargue,
        despachado: esDespachadoDoc(doc),
        reapro: esReapro(doc),
      });
    }
  }
  return mapa;
};

export const aplicarCargueAPedido = (pedido, info) => {
  const desdeCargue = info
    ? info.despachado
      ? "Despachado"
      : "Despachando"
    : "";
  const estado =
    estadoMasAvanzado(pedido.estadoSiesa, pedido.estado, desdeCargue) ||
    pedido.estado ||
    "";
  return {
    ...pedido,
    idCargue: info?.idCargue || pedido.idCargue || null,
    estado,
  };
};

export const aplicarCargueAReapro = (doc, info) => {
  if (!info) {
    return { ...doc, idCargue: doc.idCargue || null };
  }
  return {
    ...doc,
    idCargue: info.idCargue,
    estado: info.despachado ? "despachado" : "despachando",
  };
};

export const marcarOrigenesEnCargue = async (documentos, idCargue) => {
  const id = Number(idCargue) || idCargue;
  const pedidos = idEncsDe(documentos, (doc) => !esReapro(doc));
  const reapros = idEncsDe(documentos, esReapro);
  const ahora = new Date();
  if (pedidos.length) {
    await pedidosModel.updateMany(
      {
        idEnc: { $in: pedidos },
        estado: { $not: { $regex: /^(despachado|comprometido|cumplido)$/i } },
      },
      { $set: { estado: "Despachando", idCargue: id } }
    );
  }
  if (reapros.length) {
    await reaproModel.updateMany(
      { idEnc: { $in: reapros }, estado: { $nin: ["anulado", "despachado"] } },
      { $set: { estado: "despachando", idCargue: id, fecha_actualizacion: ahora } }
    );
  }
};

export const soltarOrigenesDeCargue = async (documentos) => {
  const pedidos = idEncsDe(documentos, (doc) => !esReapro(doc));
  const reapros = idEncsDe(documentos, esReapro);
  const ahora = new Date();
  if (pedidos.length) {
    const docs = await pedidosModel
      .find(
        { idEnc: { $in: pedidos }, estado: { $regex: /^despachando$/i } },
        { estadoSiesa: 1 }
      )
      .lean();
    if (docs.length) {
      await pedidosModel.bulkWrite(
        docs.map((pedido) => ({
          updateOne: {
            filter: { _id: pedido._id },
            update: {
              $set: {
                estado: pedido.estadoSiesa || "Aprobado",
                idCargue: null,
              },
            },
          },
        }))
      );
    }
  }
  if (reapros.length) {
    await reaproModel.updateMany(
      { idEnc: { $in: reapros }, estado: "despachando" },
      { $set: { estado: "aprobado", idCargue: null, fecha_actualizacion: ahora } }
    );
  }
};

export const marcarOrigenDespachando = async (doc, idCargue) => {
  const idEnc = String(doc?.idEnc || "").trim();
  if (!idEnc) return;
  const id = Number(idCargue) || idCargue || null;
  if (esReapro(doc)) {
    await reaproModel.updateOne(
      { idEnc, estado: "despachado" },
      {
        $set: {
          estado: "despachando",
          idCargue: id,
          fecha_actualizacion: new Date(),
        },
      }
    );
    return;
  }
  await pedidosModel.updateOne(
    { idEnc, estado: { $regex: /^despachado$/i } },
    { $set: { estado: "Despachando", idCargue: id } }
  );
};

export const marcarOrigenDespachado = async (doc, idCargue) => {
  const idEnc = String(doc?.idEnc || "").trim();
  if (!idEnc) return;
  const id = Number(idCargue) || idCargue || null;
  if (esReapro(doc)) {
    await reaproModel.updateOne(
      { idEnc, estado: { $ne: "anulado" } },
      {
        $set: {
          estado: "despachado",
          idCargue: id,
          fecha_actualizacion: new Date(),
        },
      }
    );
    return;
  }
  await pedidosModel.updateOne(
    {
      idEnc,
      estado: { $not: { $regex: /^(comprometido|cumplido)$/i } },
    },
    { $set: { estado: "Despachado", idCargue: id } }
  );
};

export const restaurarEstadosDesdeCargues = async () => {
  const mapa = await mapaCarguesActivos();
  if (!mapa.size) return 0;
  const opsPedidos = [];
  const opsReapro = [];
  for (const [idEnc, info] of mapa.entries()) {
    if (info.reapro) {
      opsReapro.push({
        updateOne: {
          filter: { idEnc, estado: { $ne: "anulado" } },
          update: {
            $set: {
              estado: info.despachado ? "despachado" : "despachando",
              idCargue: info.idCargue,
              fecha_actualizacion: new Date(),
            },
          },
        },
      });
    } else {
      const avanzado = info.despachado ? "Despachado" : "Despachando";
      const bloquear = info.despachado
        ? /^(despachado|comprometido|cumplido|anulado)$/i
        : /^(despachando|despachado|comprometido|cumplido|anulado)$/i;
      opsPedidos.push({
        updateOne: {
          filter: { idEnc, estado: { $not: { $regex: bloquear } } },
          update: {
            $set: {
              estado: avanzado,
              idCargue: info.idCargue,
            },
          },
        },
      });
    }
  }
  if (opsPedidos.length) await pedidosModel.bulkWrite(opsPedidos);
  if (opsReapro.length) await reaproModel.bulkWrite(opsReapro);
  return mapa.size;
};

export default {
  esAprobado,
  esCumplido,
  esLogistica,
  etiquetaEstadoPedido,
  estadoMasAvanzado,
  estadoTrasEtl,
  mapaCarguesActivos,
  aplicarCargueAPedido,
  aplicarCargueAReapro,
  marcarOrigenesEnCargue,
  soltarOrigenesDeCargue,
  marcarOrigenDespachando,
  marcarOrigenDespachado,
  restaurarEstadosDesdeCargues,
};
