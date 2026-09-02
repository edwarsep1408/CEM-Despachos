import mongoose from "mongoose";
import carguesModel from "../models/cargues.models";
import pedidosModel from "../models/pedidos.models";
import reaproModel from "../models/reaprovisionamientos.models";
import siesaPedidos from "../services/siesaPedidos.servicios";
import {
  num,
  temperaturaUnDecimal,
  normalizarLineaPiso,
  recalcularAcumulados,
  etiquetaTipoDoc,
  hayLineasUtiles,
} from "../services/piso.servicios";
import { marcarOrigenDespachado, marcarOrigenDespachando } from "../services/origenDespacho.servicios";
import { armarEtiquetasCanasta } from "../services/etiquetasCanasta.servicios";
import {
  enriquecerDocumentosVidaUtil,
  fechaVencimientoDe,
  parsearFechaLote,
  vidaUtilDeProducto,
} from "../services/vidaUtil.servicios";

const pisoCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const identityDe = (req) => req.user?.identity || {};

const esPerfilDespachador = (identity) =>
  String(identity.perfil || "").toLowerCase().includes("despachador");

const puedeVerCargue = (cargue, identity) => {
  if (!esPerfilDespachador(identity)) return true;
  const usuario = String(identity.usuario || "").trim();
  if (!usuario) return true;
  return String(cargue.despachadorUsuario || "").trim() === usuario;
};

const filtroCargues = (identity) => {
  const filtro = { estado: "enviado" };
  if (esPerfilDespachador(identity) && identity.usuario) {
    filtro.despachadorUsuario = String(identity.usuario).trim();
  }
  return filtro;
};

const buscarDocumento = (cargue, docId) => {
  const id = String(docId || "");
  return (cargue.documentos || []).find(
    (doc) =>
      String(doc._id) === id ||
      String(doc.idEnc) === id ||
      String(doc.nroDoc) === id
  );
};

const buscarLinea = (doc, lineaId) => {
  const id = String(lineaId || "");
  const lineas = doc.lineas || [];
  const idx = lineas.findIndex((l) => String(l.idLinea) === id);
  return { idx, linea: idx >= 0 ? lineas[idx] : null };
};

const estadoDoc = (doc) => String(doc?.estadoDespacho || "").toUpperCase();

const docOmitido = (doc) => !!(doc?.omitido || estadoDoc(doc) === "OMIT");

const docDespachado = (doc) => estadoDoc(doc) === "DESP";

const docCerradoPiso = (doc) => docOmitido(doc) || docDespachado(doc);

const sincronizarReabiertoDespacho = (cargue) => {
  const docs = cargue.documentos || [];
  if (docs.length && docs.every(docCerradoPiso)) {
    cargue.reabiertoDespacho = false;
  }
};

const cargueCerradoEnPiso = (cargue) => {
  const docs = cargue.documentos || [];
  return docs.length > 0 && docs.every((doc) => docDespachado(doc));
};

const lineasDesdeOrigen = async (doc) => {
  const tipo = String(doc.tipo || "").toUpperCase();
  if (tipo === "REAPRO") {
    const ra = await reaproModel.findOne({ idEnc: String(doc.idEnc) }).lean();
    return (ra?.lineas || []).map(normalizarLineaPiso);
  }
  const pedido = await pedidosModel.findOne({ idEnc: String(doc.idEnc) }).lean();
  if (!pedido) return [];
  return siesaPedidos.lineasDePedido(pedido).map(normalizarLineaPiso);
};

const completarCabecera = async (doc) => {
  const tipo = String(doc.tipo || "").toUpperCase();
  if (tipo === "REAPRO") return doc;
  const faltaCabecera = !doc.establecimiento || !doc.hora || !doc.direccion;
  const faltaPedido = !doc.tipoDocto || !doc.observacion;
  if (!faltaCabecera && !faltaPedido) return doc;
  const pedido = await pedidosModel.findOne({ idEnc: String(doc.idEnc) }).lean();
  if (!pedido) return doc;
  if (!doc.establecimiento) {
    doc.establecimiento = pedido.establecimiento || pedido.cliente || "";
  }
  if (!doc.hora) doc.hora = pedido.hora || "";
  if (!doc.direccion) {
    doc.direccion = pedido.direccionPed || pedido.direccion || "";
  }
  if (!doc.tipoDocto) doc.tipoDocto = pedido.tipoDocto || "";
  if (!doc.observacion) doc.observacion = pedido.observacion || "";
  return doc;
};

export const hidratarCargue = async (cargue) => {
  let cambio = false;
  for (const doc of cargue.documentos || []) {
    const antes = `${doc.establecimiento || ""}|${doc.hora || ""}|${doc.direccion || ""}|${doc.tipoDocto || ""}|${doc.observacion || ""}`;
    await completarCabecera(doc);
    const despues = `${doc.establecimiento || ""}|${doc.hora || ""}|${doc.direccion || ""}|${doc.tipoDocto || ""}|${doc.observacion || ""}`;
    if (antes !== despues) cambio = true;
    if (!hayLineasUtiles(doc.lineas)) {
      doc.lineas = await lineasDesdeOrigen(doc);
      cambio = true;
    } else {
      doc.lineas = (doc.lineas || []).map(normalizarLineaPiso);
    }
  }
  if (cambio) {
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
  }
  return cargue;
};

const presentarDocumento = (doc, idCargue) => {
  const lineas = (doc.lineas || []).map(normalizarLineaPiso);
  return {
    _id: String(doc._id),
    idCargue,
    tipo: doc.tipo,
    tipoDoc: etiquetaTipoDoc(doc),
    tipoDocto: doc.tipoDocto || "",
    idEnc: doc.idEnc,
    nroDoc: doc.nroDoc,
    nit: doc.nit || doc.codigoCliente || "",
    fecha: doc.fecha || "",
    hora: doc.hora || "",
    sucursal: doc.sucursal || "",
    cliente: doc.cliente || "",
    establecimiento: doc.establecimiento || doc.cliente || "",
    municipio: doc.municipio || "",
    direccion: doc.direccion || "",
    vendedor: doc.vendedor || "",
    observacion: doc.observacion || "",
    contacto: doc.contacto || "",
    omitido: !!doc.omitido,
    motivoOmision: doc.motivoOmision || "",
    estadoDespacho: doc.omitido
      ? "OMIT"
      : doc.estadoDespacho || (lineas.length && lineas.every((l) => l.estadoDespacho !== "PEND") ? "DESP" : "PEND"),
    etiquetasCanasta: Array.isArray(doc.etiquetasCanasta) ? doc.etiquetasCanasta : [],
    lineas,
  };
};

const presentarCargue = (cargue) => ({
  _id: String(cargue._id),
  idCargue: cargue.idCargue,
  despachadorNombre: cargue.despachadorNombre,
  despachadorUsuario: cargue.despachadorUsuario,
  bodega: cargue.bodega,
  bodegaNombre: cargue.bodegaNombre,
  estado: cargue.estado,
  documentos: (cargue.documentos || []).map((doc) => presentarDocumento(doc, cargue.idCargue)),
});

pisoCtr.getCargues = async (req, res) => {
  try {
    const identity = identityDe(req);
    const cargues = await carguesModel
      .find(filtroCargues(identity), {
        idCargue: 1,
        despachadorNombre: 1,
        despachadorUsuario: 1,
        bodega: 1,
        estado: 1,
        documentos: 1,
      })
      .sort({ idCargue: -1 })
      .lean();
    const abiertos = cargues.filter((c) => !cargueCerradoEnPiso(c));
    return ok(
      res,
      abiertos.map((c) => ({
        _id: String(c._id),
        idCargue: c.idCargue,
        despachador: c.despachadorUsuario || c.despachadorNombre || "",
        bodega: c.bodega,
      }))
    );
  } catch (error) {
    console.error("getCarguesPiso:", error.message);
    return fail(res, "No se pudieron leer los cargues.", 500);
  }
};

pisoCtr.getCargue = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Cargue inválido.", 400);
    const cargue = await carguesModel.findById(_id);
    if (!cargue || cargue.estado !== "enviado") {
      return fail(res, "No se encontró el cargue en piso.", 404);
    }
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    await hidratarCargue(cargue);
    const body = presentarCargue(cargue);
    body.documentos = await enriquecerDocumentosVidaUtil(body.documentos);
    return ok(res, body);
  } catch (error) {
    console.error("getCarguePiso:", error.message);
    return fail(res, "No se pudo leer el cargue.", 500);
  }
};

pisoCtr.omitirDocumento = async (req, res) => {
  try {
    const { cargueId, docId, motivo } = req.body || {};
    if (!cargueId || !docId) return fail(res, "Falta el documento.", 400);
    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return fail(res, "Indique el motivo de omisión.", 400);
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    doc.omitido = true;
    doc.motivoOmision = motivoTxt;
    doc.estadoDespacho = "OMIT";
    sincronizarReabiertoDespacho(cargue);
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    return ok(res, presentarDocumento(doc, cargue.idCargue));
  } catch (error) {
    console.error("omitirDocumentoPiso:", error.message);
    return fail(res, "No se pudo omitir el documento.", 500);
  }
};

pisoCtr.omitirLinea = async (req, res) => {
  try {
    const { cargueId, docId, lineaId, motivo } = req.body || {};
    if (!cargueId || !docId || !lineaId) return fail(res, "Falta la línea.", 400);
    const motivoTxt = String(motivo || "").trim();
    if (!motivoTxt) return fail(res, "Indique el motivo de omisión.", 400);
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    if (doc.omitido) return fail(res, "Este documento ya fue omitido.", 400);
    if (docDespachado(doc)) {
      return fail(res, "Este documento ya fue finalizado. Use Repesar para volver a pesarlo.", 400);
    }
    const { idx, linea } = buscarLinea(doc, lineaId);
    if (!linea) return fail(res, "No se encontró el producto.", 404);
    const actualizada = recalcularAcumulados({
      ...linea,
      omitido: true,
      motivoOmision: motivoTxt,
    });
    doc.lineas[idx] = actualizada;
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    return ok(res, presentarDocumento(doc, cargue.idCargue));
  } catch (error) {
    console.error("omitirLineaPiso:", error.message);
    return fail(res, "No se pudo omitir el producto.", 500);
  }
};

pisoCtr.registrarPesaje = async (req, res) => {
  try {
    const {
      cargueId,
      docId,
      lineaId,
      unidades,
      peso,
      tara,
      taraDetalle,
      lote,
      temperatura,
      fechaVencimiento,
    } = req.body || {};
    if (!cargueId || !docId || !lineaId) return fail(res, "Falta el producto.", 400);
    const pesoN = num(peso);
    const undN = num(unidades);
    const taraN = num(tara);
    const loteTxt = String(lote ?? "").trim();
    if (!loteTxt || loteTxt === "0") return fail(res, "Indique el lote.", 400);
    if (!(taraN > 0)) return fail(res, "Indique la tara.", 400);
    if (!(undN > 0)) return fail(res, "Indique las unidades.", 400);
    if (pesoN < 0) return fail(res, "El peso no puede ser negativo.", 400);
    if (!(pesoN > 1)) return fail(res, "El peso debe ser mayor a 1 kg.", 400);
    if (pesoN - taraN < 0) {
      return fail(res, "El peso neto no puede ser negativo. La tara es mayor que el peso.", 400);
    }
    const temp = temperaturaUnDecimal(temperatura);
    if (!temp) return fail(res, "Indique la temperatura con un decimal (ej. 4.0).", 400);
    const pNeto = Number((pesoN - taraN).toFixed(3));
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    if (doc.omitido) return fail(res, "Este documento ya fue omitido.", 400);
    if (docDespachado(doc)) {
      return fail(res, "Este documento ya fue finalizado. Use Repesar para volver a pesarlo.", 400);
    }
    const { idx, linea } = buscarLinea(doc, lineaId);
    if (!linea) return fail(res, "No se encontró el producto.", 404);
    if (linea.omitido) return fail(res, "Este producto ya fue omitido.", 400);
    const fechaLote = parsearFechaLote(loteTxt);
    const vida = await vidaUtilDeProducto(linea);
    const calculado = fechaVencimientoDe(vida.meses, vida.dias, fechaLote);
    const vencimiento = calculado || String(fechaVencimiento || "").trim();
    const pesaje = {
      idPesaje: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      unidades: undN,
      peso: pesoN,
      tara: taraN,
      taraDetalle: taraDetalle && typeof taraDetalle === "object" ? taraDetalle : {},
      lote: loteTxt || "0",
      temperatura: temp,
      fechaVencimiento: vencimiento,
      pNeto,
      fecha: new Date().toISOString(),
    };
    const actualizada = recalcularAcumulados({
      ...linea,
      pesajes: [...(linea.pesajes || []), pesaje],
    });
    doc.lineas[idx] = actualizada;
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    return ok(res, {
      documento: presentarDocumento(doc, cargue.idCargue),
      linea: actualizada,
    });
  } catch (error) {
    console.error("registrarPesajePiso:", error.message);
    return fail(res, "No se pudo registrar el peso.", 500);
  }
};

pisoCtr.quitarPesaje = async (req, res) => {
  try {
    const { cargueId, docId, lineaId, idPesaje } = req.body || {};
    if (!cargueId || !docId || !lineaId || !idPesaje) {
      return fail(res, "Falta el pesaje.", 400);
    }
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    if (docDespachado(doc)) {
      return fail(res, "Este documento ya fue finalizado. Use Repesar para volver a pesarlo.", 400);
    }
    const { idx, linea } = buscarLinea(doc, lineaId);
    if (!linea) return fail(res, "No se encontró el producto.", 404);
    const actualizada = recalcularAcumulados({
      ...linea,
      pesajes: (linea.pesajes || []).filter((p) => String(p.idPesaje) !== String(idPesaje)),
    });
    doc.lineas[idx] = actualizada;
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    return ok(res, {
      documento: presentarDocumento(doc, cargue.idCargue),
      linea: actualizada,
    });
  } catch (error) {
    console.error("quitarPesajePiso:", error.message);
    return fail(res, "No se pudo quitar el pesaje.", 500);
  }
};

pisoCtr.repesar = async (req, res) => {
  try {
    const { cargueId, docId, lineaId } = req.body || {};
    if (!cargueId || !docId) return fail(res, "Falta el documento.", 400);
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    const estabaDesp = docDespachado(doc);
    const estabaOmit = docOmitido(doc);

    if (lineaId) {
      const { idx, linea } = buscarLinea(doc, lineaId);
      if (!linea) return fail(res, "No se encontró el producto.", 404);
      const lineaOmit = !!(linea.omitido || String(linea.estadoDespacho || "").toUpperCase() === "OMIT");
      const tienePesajes =
        (linea.pesajes || []).length > 0 || String(linea.estadoDespacho || "").toUpperCase() === "DESP";
      if (!tienePesajes && !lineaOmit && !estabaDesp && !estabaOmit) {
        return fail(res, "Este producto no tiene pesaje para repetir.", 400);
      }
      doc.lineas[idx] = recalcularAcumulados({
        ...linea,
        omitido: false,
        motivoOmision: "",
        pesajes: [],
      });
    } else if (!estabaDesp && !estabaOmit) {
      return fail(res, "Este documento no está finalizado ni omitido.", 400);
    }

    if (estabaDesp || estabaOmit) {
      doc.omitido = false;
      doc.motivoOmision = "";
      doc.estadoDespacho = "PEND";
    }
    doc.etiquetasCanasta = [];
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    if (estabaDesp) await marcarOrigenDespachando(doc, cargue.idCargue);
    return ok(res, presentarDocumento(doc, cargue.idCargue));
  } catch (error) {
    console.error("repesarPiso:", error.message);
    return fail(res, "No se pudo volver a pesar.", 500);
  }
};

pisoCtr.finalizarDocumento = async (req, res) => {
  try {
    const { cargueId, docId } = req.body || {};
    if (!cargueId || !docId) return fail(res, "Falta el documento.", 400);
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    if (doc.omitido) return fail(res, "Este documento ya fue omitido.", 400);
    doc.lineas = (doc.lineas || []).map(normalizarLineaPiso);
    const pendientes = (doc.lineas || []).filter((l) => !l.omitido && l.estadoDespacho === "PEND");
    const forzar = Boolean(req.body?.forzar);
    if (pendientes.length && !forzar) {
      return fail(
        res,
        `Quedan ${pendientes.length} producto(s) pendientes. Péselos u omítalos antes de finalizar, o confirme el guardado.`,
        400
      );
    }
    doc.estadoDespacho = "DESP";
    sincronizarReabiertoDespacho(cargue);
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    await marcarOrigenDespachado(doc, cargue.idCargue);
    return ok(res, presentarDocumento(doc, cargue.idCargue));
  } catch (error) {
    console.error("finalizarDocumentoPiso:", error.message);
    return fail(res, "No se pudo finalizar el documento.", 500);
  }
};

pisoCtr.registrarEtiquetas = async (req, res) => {
  try {
    const { cargueId, docId, totalCanastas } = req.body || {};
    const total = Math.floor(Number(totalCanastas) || 0);
    if (!cargueId || !docId) return fail(res, "Falta el documento.", 400);
    if (total < 1) return fail(res, "Indique cuántas canastas imprimir.", 400);
    const cargue = await carguesModel.findById(cargueId);
    if (!cargue || cargue.estado !== "enviado") return fail(res, "No se encontró el cargue.", 404);
    if (!puedeVerCargue(cargue, identityDe(req))) {
      return fail(res, "Este cargue no está asignado a usted.", 403);
    }
    const doc = buscarDocumento(cargue, docId);
    if (!doc) return fail(res, "No se encontró el documento.", 404);
    if (doc.omitido) return fail(res, "Este documento ya fue omitido.", 400);
    doc.lineas = (doc.lineas || []).map(normalizarLineaPiso);
    const pendientes = (doc.lineas || []).filter((l) => !l.omitido && l.estadoDespacho === "PEND");
    if (pendientes.length) {
      return fail(res, "Termine de pesar el documento para imprimir etiquetas.", 400);
    }
    if (!String(doc.tipoDocto || "").trim() && String(doc.tipo || "").toUpperCase() === "PEDIDO") {
      const pedido = await pedidosModel.findOne({ idEnc: String(doc.idEnc) }, { tipoDocto: 1 }).lean();
      if (pedido?.tipoDocto) doc.tipoDocto = pedido.tipoDocto;
    }
    const etiquetas = armarEtiquetasCanasta(doc, total);
    const vistos = new Set();
    for (const et of etiquetas) {
      if (vistos.has(et.codigo)) {
        return fail(res, `El código ${et.codigo} quedó repetido.`, 400);
      }
      vistos.add(et.codigo);
    }
    doc.etiquetasCanasta = etiquetas;
    cargue.markModified("documentos");
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    return ok(res, {
      documento: presentarDocumento(doc, cargue.idCargue),
      etiquetas,
    });
  } catch (error) {
    console.error("registrarEtiquetasPiso:", error.message);
    return fail(res, "No se pudieron registrar las etiquetas.", 500);
  }
};

export default pisoCtr;
