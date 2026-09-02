import mongoose from "mongoose";
import reaproModel from "../models/reaprovisionamientos.models";
import carguesModel from "../models/cargues.models";
import bodegaModel from "../models/bodega.models";
import itemsModel from "../models/items.models";
import { parsearExcelReapro } from "../services/reaproExcel.servicios";
import {
  aplicarCargueAReapro,
  mapaCarguesActivos,
} from "../services/origenDespacho.servicios";

const reaproCtr = {};

const ESTADOS = ["temporal", "aprobado", "anulado"];

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const fechaHoy = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const usuarioDe = (req) => {
  const identity = req.user?.identity || {};
  return String(identity.nombre || identity.usuario || "Administrador").trim();
};

const idEncDe = (idReapro) => `RA-${String(idReapro).padStart(5, "0")}`;

const siguienteId = async () => {
  const ultimo = await reaproModel.findOne().sort({ idReapro: -1 }).lean();
  return (ultimo?.idReapro || 0) + 1;
};

const totalesDe = (lineas = []) => {
  const peso = lineas.reduce((acc, linea) => acc + (Number(linea.kilos) || 0), 0);
  const unidades = lineas.reduce((acc, linea) => acc + (Number(linea.unidades) || 0), 0);
  return {
    peso: Number(peso.toFixed(2)),
    unidades: Number(unidades.toFixed(2)),
  };
};

const limpiarLineas = (lineas) => {
  if (!Array.isArray(lineas)) return [];
  const porRef = new Map();
  for (const raw of lineas) {
    const referencia = String(raw.referencia || raw.codigoItem || raw.item || "").trim();
    if (!referencia) continue;
    const unidades = Number(raw.unidades);
    const kilos = Number(raw.kilos);
    porRef.set(referencia, {
      item: String(raw.item || "").trim(),
      codigoItem: String(raw.codigoItem || "").trim(),
      referencia,
      descripcion: String(raw.descripcion || "").trim(),
      undInventario: String(raw.undInventario || "").trim(),
      unidades: Number.isFinite(unidades) ? unidades : 0,
      kilos: Number.isFinite(kilos) ? kilos : 0,
    });
  }
  return [...porRef.values()];
};

const buscarBodega = async (codigo) => {
  const valor = String(codigo || "").trim();
  if (!valor) return null;
  return bodegaModel
    .findOne({
      estado: 0,
      $or: [{ codigo: valor }, { codigo: valor.toUpperCase() }, { nombre: valor }],
    })
    .lean();
};

const resolverBodega = async (codigo, nombreHint) => {
  const local = await buscarBodega(codigo);
  if (local) return { codigo: local.codigo, nombre: local.nombre || local.codigo };
  const valor = String(codigo || "").trim();
  if (!valor) return null;
  return { codigo: valor, nombre: String(nombreHint || valor).trim() || valor };
};

const resolverCedi = async (etiqueta) => {
  const nombre = String(etiqueta || "").trim();
  if (!nombre) return null;
  const corto = nombre.replace(/^CEDI\s+/i, "").trim();
  const todas = await bodegaModel.find({ estado: 0 }).lean();
  const igual = (a, b) =>
    String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
  const contiene = (a, b) =>
    String(a || "").toUpperCase().includes(String(b || "").toUpperCase());
  const hit =
    todas.find((b) => igual(b.nombre, nombre) || igual(b.codigo, nombre)) ||
    todas.find((b) => igual(b.nombre, corto) || igual(b.codigo, corto)) ||
    todas.find((b) => contiene(b.nombre, nombre) || contiene(b.codigo, nombre)) ||
    (corto ? todas.find((b) => contiene(b.nombre, corto) || contiene(b.codigo, corto)) : null);
  if (hit) return { codigo: hit.codigo, nombre: hit.nombre || hit.codigo };
  return { codigo: nombre, nombre };
};

const enriquecerLineas = async (lineasExcel) => {
  const avisos = [];
  const lineas = [];
  for (const raw of lineasExcel) {
    const referencia = String(raw.referencia || "").trim();
    const hallado = await itemsModel
      .findOne({
        $or: [{ referencia }, { codigoItem: referencia }, { item: referencia }],
      })
      .lean();
    if (!hallado) avisos.push(`Sin ítem en el catálogo: ${referencia}`);
    lineas.push({
      item: hallado?.item || "",
      codigoItem: hallado?.codigoItem || "",
      referencia: hallado?.referencia || referencia,
      descripcion: hallado?.descripcion || raw.descripcion || "",
      undInventario: hallado?.undInventario || "",
      unidades: Number(raw.unidades) || 0,
      kilos: Number(raw.kilos) || 0,
    });
  }
  return { lineas: limpiarLineas(lineas), avisos };
};

const enCargueActivo = async (idEnc) => {
  const hallado = await carguesModel
    .findOne({
      estado: { $in: ["pendiente", "enviado"] },
      "documentos.idEnc": String(idEnc),
    })
    .lean();
  return hallado;
};

export const snapshotReapro = (doc) => {
  const lineas = (doc.lineas || []).map((linea) => ({
    item: linea.item || "",
    codigoItem: linea.codigoItem || "",
    referencia: linea.referencia || "",
    descripcion: linea.descripcion || "",
    undInventario: linea.undInventario || "",
    cant1: Number(linea.unidades) || 0,
    cant2: Number(linea.kilos) || 0,
    kilo: Number(linea.kilos) || 0,
    unidades: Number(linea.unidades) || 0,
    kilos: Number(linea.kilos) || 0,
  }));
  return {
    tipo: "REAPRO",
    tipoDoc: "REAPROVISIONAMIENTO",
    idEnc: String(doc.idEnc || ""),
    nroDoc: String(doc.idEnc || doc.idReapro || ""),
    tipoDocto: "RA",
    nit: doc.bodegaDestino || "",
    codigoCliente: doc.bodegaDestino || "",
    codigo: doc.bodegaDestino || "",
    observacion: doc.observacion || "",
    fecha: doc.fecha || "",
    sucursal: doc.bodegaDestinoNombre || doc.bodegaDestino || "",
    municipio: "",
    barrio: "",
    cndPago: "",
    direccion: "",
    vendedor: "",
    contacto: "",
    telefono: "",
    valor: 0,
    peso: Number(doc.peso) || 0,
    unidades: Number(doc.unidades) || 0,
    cliente: `CEDIS ${doc.bodegaDestinoNombre || doc.bodegaDestino || ""}`.trim(),
    establecimiento: doc.bodegaDestinoNombre || doc.bodegaDestino || "",
    hora: "",
    bodega: doc.bodegaOrigen || "",
    estado: doc.estado || "",
    lineas,
  };
};

const resumen = (doc) => {
  const { peso, unidades } = totalesDe(doc.lineas);
  return {
    ...doc,
    peso: doc.peso ?? peso,
    unidades: doc.unidades ?? unidades,
    totalLineas: (doc.lineas || []).length,
  };
};

reaproCtr.listar = async (req, res) => {
  try {
    const estado = String(req.query.estado || "").trim().toLowerCase();
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    const origen = String(req.query.origen || "").trim();
    const destino = String(req.query.destino || "").trim();
    const filtro = {};
    if (estado === "aprobado") {
      filtro.estado = { $in: ["aprobado", "despachando", "despachado"] };
    } else if (ESTADOS.includes(estado)) {
      filtro.estado = estado;
    }
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = hasta;
    }
    if (origen) filtro.bodegaOrigen = origen;
    if (destino) filtro.bodegaDestino = destino;

    const body = await reaproModel.find(filtro).sort({ idReapro: -1 }).lean();
    const enCargue = await mapaCarguesActivos();
    return ok(
      res,
      body.map((doc) =>
        aplicarCargueAReapro(resumen(doc), enCargue.get(String(doc.idEnc)))
      )
    );
  } catch (error) {
    console.error("listar reapro:", error.message);
    return fail(res, "No se pudieron leer los reaprovisionamientos.", 500);
  }
};

reaproCtr.getUno = async (req, res) => {
  try {
    const body = await reaproModel.findById(req.params._id).lean();
    if (!body) return fail(res, "No se encontró el reaprovisionamiento.", 404);
    const enCargue = await mapaCarguesActivos();
    return ok(res, aplicarCargueAReapro(resumen(body), enCargue.get(String(body.idEnc))));
  } catch (error) {
    return fail(res, "No se pudo leer el reaprovisionamiento.", 500);
  }
};

reaproCtr.crear = async (req, res) => {
  try {
    const fecha = String(req.body?.fecha || fechaHoy()).slice(0, 10);
    const observacion = String(req.body?.observacion || "").trim();
    const origen = await resolverBodega(req.body?.bodegaOrigen, req.body?.bodegaOrigenNombre);
    const destino = await resolverBodega(req.body?.bodegaDestino, req.body?.bodegaDestinoNombre);
    if (!origen) return fail(res, "Seleccione la bodega de origen.");
    if (!destino) return fail(res, "Seleccione el CEDIS destino.");
    if (String(origen.codigo) === String(destino.codigo)) {
      return fail(res, "El origen y el CEDIS destino deben ser distintos.");
    }

    const idReapro = await siguienteId();
    const body = await new reaproModel({
      idReapro,
      idEnc: idEncDe(idReapro),
      fecha,
      usuario: usuarioDe(req),
      bodegaOrigen: origen.codigo,
      bodegaOrigenNombre: origen.nombre,
      bodegaDestino: destino.codigo,
      bodegaDestinoNombre: destino.nombre,
      observacion,
      estado: "temporal",
      envioSiesa: { estado: "pendiente", mensaje: "", fecha: null },
    }).save();
    return ok(res, resumen(body.toObject()));
  } catch (error) {
    console.error("crear reapro:", error.message);
    return fail(res, "No se pudo crear el reaprovisionamiento.", 500);
  }
};

reaproCtr.actualizar = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Documento inválido.");
    const doc = await reaproModel.findById(_id);
    if (!doc) return fail(res, "No se encontró el reaprovisionamiento.", 404);
    if (doc.estado !== "temporal") {
      return fail(res, "Solo se editan reaprovisionamientos temporales.", 400);
    }

    if (req.body.fecha) doc.fecha = String(req.body.fecha).slice(0, 10);
    if (req.body.observacion != null) doc.observacion = String(req.body.observacion).trim();

    if (req.body.bodegaOrigen) {
      const origen = await resolverBodega(req.body.bodegaOrigen, req.body.bodegaOrigenNombre);
      if (!origen) return fail(res, "Bodega de origen inválida.");
      doc.bodegaOrigen = origen.codigo;
      doc.bodegaOrigenNombre = origen.nombre;
    }
    if (req.body.bodegaDestino) {
      const destino = await resolverBodega(req.body.bodegaDestino, req.body.bodegaDestinoNombre);
      if (!destino) return fail(res, "CEDIS destino inválido.");
      doc.bodegaDestino = destino.codigo;
      doc.bodegaDestinoNombre = destino.nombre;
    }
    if (doc.bodegaOrigen === doc.bodegaDestino) {
      return fail(res, "El origen y el CEDIS destino deben ser distintos.");
    }

    if (req.body.lineas != null) {
      doc.lineas = limpiarLineas(req.body.lineas);
      const tot = totalesDe(doc.lineas);
      doc.peso = tot.peso;
      doc.unidades = tot.unidades;
    }

    doc.fecha_actualizacion = new Date();
    await doc.save();
    return ok(res, resumen(doc.toObject()));
  } catch (error) {
    console.error("actualizar reapro:", error.message);
    return fail(res, "No se pudo guardar el reaprovisionamiento.", 500);
  }
};

reaproCtr.aprobar = async (req, res) => {
  try {
    const doc = await reaproModel.findById(req.params._id);
    if (!doc) return fail(res, "No se encontró el reaprovisionamiento.", 404);
    if (doc.estado !== "temporal") {
      return fail(res, "Solo se aprueba un documento temporal.", 400);
    }
    const lineas = limpiarLineas(doc.lineas);
    const tot = totalesDe(lineas);
    if (!lineas.length || (tot.unidades <= 0 && tot.peso <= 0)) {
      return fail(res, "Agregue al menos una línea con unidades o kilos.");
    }
    doc.lineas = lineas;
    doc.peso = tot.peso;
    doc.unidades = tot.unidades;
    doc.estado = "aprobado";
    doc.fecha_actualizacion = new Date();
    await doc.save();
    return ok(res, resumen(doc.toObject()));
  } catch (error) {
    return fail(res, "No se pudo aprobar el reaprovisionamiento.", 500);
  }
};

reaproCtr.anular = async (req, res) => {
  try {
    const doc = await reaproModel.findById(req.params._id);
    if (!doc) return fail(res, "No se encontró el reaprovisionamiento.", 404);
    if (doc.estado === "anulado") return fail(res, "Ya está anulado.", 400);
    if (["despachando", "despachado"].includes(String(doc.estado || "").toLowerCase())) {
      return fail(
        res,
        doc.idCargue
          ? `No se puede anular: está ${doc.estado} en el cargue ${doc.idCargue}.`
          : `No se puede anular un reaprovisionamiento ${doc.estado}.`,
        400
      );
    }
    const cargue = await enCargueActivo(doc.idEnc);
    if (cargue) {
      return fail(
        res,
        `No se puede anular: está en el cargue ${cargue.idCargue}. Quítelo del cargue primero.`,
        400
      );
    }
    doc.estado = "anulado";
    doc.fecha_actualizacion = new Date();
    await doc.save();
    return ok(res, resumen(doc.toObject()));
  } catch (error) {
    return fail(res, "No se pudo anular el reaprovisionamiento.", 500);
  }
};

reaproCtr.enviarSiesa = async (req, res) => {
  try {
    const doc = await reaproModel.findById(req.params._id);
    if (!doc) return fail(res, "No se encontró el reaprovisionamiento.", 404);
    if (doc.estado !== "aprobado") {
      return fail(res, "Apruebe el documento antes de enviarlo a SIESA.", 400);
    }
    return fail(
      res,
      "El envío a SIESA para que cree el documento se conecta en un siguiente paso.",
      501
    );
  } catch (error) {
    return fail(res, "No se pudo enviar a SIESA.", 500);
  }
};

reaproCtr.buscarItems = async (req, res) => {
  try {
    const q = String(req.query.q || req.body?.searchTerm || "").trim();
    if (q.length < 2) return ok(res, []);
    const regex = { $regex: q, $options: "i" };
    const body = await itemsModel
      .find({
        $or: [{ referencia: regex }, { descripcion: regex }, { codigoItem: regex }, { item: regex }],
      })
      .limit(40)
      .lean();
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron buscar ítems.", 500);
  }
};

reaproCtr.importarExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) return fail(res, "Adjunte el Excel del CEDIS (.xlsx).");
    let parsed;
    try {
      parsed = parsearExcelReapro(req.file.buffer);
    } catch (error) {
      return fail(res, error.message || "No se pudo leer la hoja FORMATO.", 400);
    }

    const origen = await resolverBodega(req.body?.bodegaOrigen, req.body?.bodegaOrigenNombre);
    if (!origen) return fail(res, "Seleccione la bodega de origen (planta que despacha).");
    const destino = await resolverCedi(parsed.cedi);
    if (!destino) return fail(res, "No se pudo leer el CEDIS destino en A1.");
    if (String(origen.codigo) === String(destino.codigo)) {
      return fail(res, "El origen y el CEDIS destino deben ser distintos.");
    }

    const { lineas, avisos } = await enriquecerLineas(parsed.lineas);
    const tot = totalesDe(lineas);
    const idReapro = await siguienteId();
    const observacion = String(req.body?.observacion || "").trim();
    const body = await new reaproModel({
      idReapro,
      idEnc: idEncDe(idReapro),
      fecha: String(req.body?.fecha || fechaHoy()).slice(0, 10),
      usuario: usuarioDe(req),
      bodegaOrigen: origen.codigo,
      bodegaOrigenNombre: origen.nombre,
      bodegaDestino: destino.codigo,
      bodegaDestinoNombre: destino.nombre,
      observacion: observacion || parsed.cedi,
      archivoNombre: req.file.originalname || "",
      cediEtiqueta: parsed.cedi,
      avisos,
      lineas,
      peso: tot.peso,
      unidades: tot.unidades,
      estado: "aprobado",
      envioSiesa: { estado: "pendiente", mensaje: "", fecha: null },
    }).save();
    return ok(res, resumen(body.toObject()));
  } catch (error) {
    console.error("importarExcel reapro:", error.message);
    return fail(res, "No se pudo importar el Excel de reaprovisionamiento.", 500);
  }
};

export default reaproCtr;
