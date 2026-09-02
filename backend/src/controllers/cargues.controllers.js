import carguesModel from "../models/cargues.models";
import usuariosModel from "../models/usuarios.models";
import pedidosModel from "../models/pedidos.models";
import reaproModel from "../models/reaprovisionamientos.models";
import siesaPedidos from "../services/siesaPedidos.servicios";
import { snapshotReapro } from "./reaprovisionamientos.controllers";
import { hidratarCargue } from "./piso.controllers";
import { esUsuarioDespachador } from "./seguridad.controllers";
import { normalizarLineaPiso, progresoCargue } from "../services/piso.servicios";
import {
  esAprobado,
  esLogistica,
  marcarOrigenesEnCargue,
  marcarOrigenDespachando,
  soltarOrigenesDeCargue,
} from "../services/origenDespacho.servicios";
import {
  bloqueoPedidoEnCargue,
  ocupacionDocumentos,
  pedidoClave,
  textoOcupado,
} from "../services/documentosOcupados.servicios";

const carguesCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 500) =>
  res.status(status).json({ status, body: { message }, error: true });

const mismaBodega = (a, b) =>
  String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();

const pesoDeLineas = (lineas = []) =>
  lineas.reduce((acc, linea) => acc + (Number(linea.kilo) || Number(linea.cant2) || 0), 0);

const documentoDesdeSnap = (snap) => ({
  tipo: snap.tipo,
  tipoDoc: snap.tipoDoc,
  idEnc: snap.idEnc,
  nroDoc: snap.nroDoc,
  tipoDocto: snap.tipoDocto,
  nit: snap.nit,
  fecha: snap.fecha,
  sucursal: snap.sucursal,
  municipio: snap.municipio,
  barrio: snap.barrio,
  cndPago: snap.cndPago,
  direccion: snap.direccion,
  vendedor: snap.vendedor,
  codigo: snap.codigo,
  codigoCliente: snap.codigoCliente,
  observacion: snap.observacion,
  contacto: snap.contacto,
  telefono: snap.telefono,
  valor: snap.valor,
  peso: snap.peso,
  cliente: snap.cliente,
  establecimiento: snap.establecimiento || snap.cliente || "",
  hora: snap.hora || "",
  bodega: snap.bodega,
  unidades: snap.unidades || 0,
  omitido: false,
  estadoDespacho: "PEND",
  lineas: (snap.lineas || []).map(normalizarLineaPiso),
});

const codigoClienteDe = (pedido) => {
  const nit = String(pedido.nit || "").trim();
  const sucursal = String(pedido.sucursal || "").trim();
  if (nit && sucursal && !nit.includes("-")) return `${nit}-${sucursal}`;
  return nit || sucursal;
};

const snapshotPedido = (pedido) => {
  const lineas = siesaPedidos.lineasDePedido(pedido);
  const { bodega } = siesaPedidos.resolverBodegaPedido(pedido, lineas);
  const crudo = Array.isArray(pedido.siesa) ? pedido.siesa[0] : {};
  const estadoSiesa =
    siesaPedidos.etiquetaEstado(crudo) ||
    pedido.estadoSiesa ||
    pedido.estado ||
    lineas[0]?.estado ||
    "";
  const estado = esLogistica(pedido.estado) ? pedido.estado : estadoSiesa;
  return {
    tipo: "PEDIDO",
    tipoDoc: "PEDIDO",
    idEnc: String(pedido.idEnc || ""),
    nroDoc: String(pedido.idEnc || pedido.codigo || ""),
    tipoDocto: pedido.tipoDocto || "",
    nit: pedido.nit || "",
    codigoCliente: codigoClienteDe(pedido),
    codigo: pedido.codigo || "",
    observacion: pedido.observacion || "",
    fecha: pedido.fecha || "",
    sucursal: pedido.sucursalDescripcion || pedido.sucursal || pedido.establecimiento || "",
    municipio: pedido.municipio || "",
    barrio: pedido.barrioPed || pedido.barrio || "",
    cndPago: pedido.cp != null && pedido.cp !== "" ? String(pedido.cp) : "",
    direccion: pedido.direccionPed || pedido.direccion || "",
    vendedor: pedido.vendedor || "",
    contacto: pedido.contacto || "",
    telefono: pedido.telefono || "",
    valor: Number(pedido.valor) || 0,
    peso: Number(pesoDeLineas(lineas).toFixed(2)),
    cliente: pedido.cliente || "",
    establecimiento: pedido.establecimiento || pedido.cliente || "",
    hora: pedido.hora || "",
    bodega,
    estado,
    lineas: lineas.map(normalizarLineaPiso),
  };
};

const idsEnCarguesActivos = async (exceptoCargueId) => {
  const ocupacion = await ocupacionDocumentos();
  const ids = new Set();
  for (const [idEnc, info] of ocupacion.pedidosEnCargues) {
    if (exceptoCargueId && info.id === String(exceptoCargueId)) continue;
    ids.add(idEnc);
  }
  for (const idEnc of ocupacion.pedidosEnHojas.keys()) ids.add(idEnc);
  return ids;
};

const siguienteIdCargue = async () => {
  const ultimo = await carguesModel.findOne().sort({ idCargue: -1 }).lean();
  return (ultimo?.idCargue || 130000) + 1;
};

const cargarDespachador = async (id) => {
  const usuario = await usuariosModel
    .findOne({ _id: id, estado: 0 })
    .populate("perfil", "nombre");
  if (!usuario || !esUsuarioDespachador(usuario)) return null;
  return usuario;
};

const resumenCargue = (cargue) => {
  const documentos = cargue.documentos || [];
  const peso = documentos.reduce((acc, doc) => acc + (Number(doc.peso) || 0), 0);
  return {
    ...cargue,
    totalDocumentos: documentos.length,
    totalPeso: Number(peso.toFixed(2)),
  };
};

carguesCtr.getBodegasPedidos = async (_req, res) => {
  try {
    const codigos = await pedidosModel.distinct("bodega");
    const body = codigos
      .map((codigo) => String(codigo || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((codigo) => ({ codigo, nombre: codigo }));
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer las bodegas de pedidos.");
  }
};

carguesCtr.getPendientes = async (_req, res) => {
  try {
    const body = await carguesModel
      .find({ estado: "pendiente" })
      .sort({ idCargue: -1 })
      .lean();
    return ok(res, body.map(resumenCargue));
  } catch (error) {
    return fail(res, "No se pudieron leer los cargues pendientes.");
  }
};

carguesCtr.getCargue = async (req, res) => {
  try {
    const body = await carguesModel.findById(req.params._id).lean();
    if (!body) return fail(res, "No se encontró el cargue.", 404);
    return ok(res, resumenCargue(body));
  } catch (error) {
    return fail(res, "No se pudo leer el cargue.");
  }
};

carguesCtr.postCargue = async (req, res) => {
  try {
    const despachador = await cargarDespachador(req.body?.despachadorId);
    if (!despachador) {
      return fail(res, "Seleccione un despachador válido.", 400);
    }
    if (!despachador.bodega) {
      return fail(
        res,
        "El despachador no tiene bodega asignada. Configúrela en Asignación de bodega.",
        400
      );
    }
    const body = await new carguesModel({
      idCargue: await siguienteIdCargue(),
      despachadorId: despachador._id,
      despachadorNombre: despachador.nombre || despachador.usuario,
      despachadorUsuario: despachador.usuario,
      bodega: despachador.bodega,
      bodegaNombre: despachador.bodegaNombre || "",
    }).save();
    return ok(res, resumenCargue(body.toObject()));
  } catch (error) {
    return fail(res, "No se pudo crear el cargue.");
  }
};

carguesCtr.getDocumentosDisponibles = async (req, res) => {
  try {
    const tipo = String(req.query.tipo || "PEDIDO").toUpperCase();
    const cargue = await carguesModel.findById(req.query.cargueId).lean();
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    if (cargue.estado !== "pendiente") {
      return fail(res, "Este cargue ya no admite documentos.", 400);
    }

    const ocupados = await idsEnCarguesActivos(cargue._id);
    for (const doc of cargue.documentos || []) {
      if (doc.idEnc) ocupados.add(String(doc.idEnc));
    }

    if (tipo === "OC" || tipo === "TRANSITO") {
      return ok(res, []);
    }

    if (tipo === "REAPRO" || tipo === "REAPROVISIONAMIENTO") {
      const lista = await reaproModel
        .find({ estado: { $in: ["aprobado", "temporal"] } })
        .lean();
      const body = lista
        .map(snapshotReapro)
        .filter((item) => item.idEnc && !ocupados.has(item.idEnc))
        .sort((a, b) => {
          const misma = mismaBodega(a.bodega, cargue.bodega) ? 0 : 1;
          const otra = mismaBodega(b.bodega, cargue.bodega) ? 0 : 1;
          if (misma !== otra) return misma - otra;
          return String(b.idEnc).localeCompare(String(a.idEnc));
        });
      return ok(res, body);
    }

    const pedidos = await pedidosModel
      .find({}, { siesa: 0, lineas: 0 })
      .lean();
    const body = pedidos
      .map((pedido) => {
        const snap = snapshotPedido(pedido);
        return { ...snap, peso: Number(pedido.peso) || snap.peso || 0 };
      })
      .filter(
        (item) =>
          esAprobado(item.estado) &&
          mismaBodega(item.bodega, cargue.bodega) &&
          item.idEnc &&
          !ocupados.has(item.idEnc)
      )
      .sort((a, b) => String(b.idEnc).localeCompare(String(a.idEnc)));

    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer los documentos disponibles.");
  }
};

carguesCtr.agregarDocumentos = async (req, res) => {
  try {
    const { _id, tipo, ids } = req.body || {};
    const cargue = await carguesModel.findById(_id);
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    if (cargue.estado !== "pendiente") {
      return fail(res, "Este cargue ya no admite documentos.", 400);
    }
    const tipoDoc = String(tipo || "PEDIDO").toUpperCase();
    const lista = Array.isArray(ids) ? ids.map(String) : [];
    if (!lista.length) return fail(res, "Seleccione al menos un documento.", 400);

    const ocupacion = await ocupacionDocumentos();
    const bloqueados = [];
    const nuevos = [];
    if (tipoDoc === "REAPRO" || tipoDoc === "REAPROVISIONAMIENTO") {
      const docs = await reaproModel.find({ idEnc: { $in: lista } }).lean();
      const porId = new Map(docs.map((item) => [String(item.idEnc), item]));
      for (const idEnc of lista) {
        const bloqueo = bloqueoPedidoEnCargue(ocupacion, idEnc, cargue._id);
        if (bloqueo) {
          bloqueados.push(textoOcupado(idEnc, bloqueo));
          continue;
        }
        const reapro = porId.get(idEnc);
        if (!reapro || !["aprobado", "temporal"].includes(reapro.estado)) continue;
        const snap = snapshotReapro(reapro);
        nuevos.push(documentoDesdeSnap(snap));
        ocupacion.pedidosEnCargues.set(pedidoClave(idEnc), {
          ambito: "cargue",
          id: String(cargue._id),
          etiqueta: `el cargue ${cargue.idCargue}`,
        });
        if (reapro.estado === "temporal") {
          await reaproModel.updateOne(
            { _id: reapro._id },
            { $set: { estado: "aprobado", fecha_actualizacion: new Date() } }
          );
        }
      }
      if (bloqueados.length && !nuevos.length) {
        return fail(res, `Un documento no puede repetirse en hojas de ruta ni cargues. ${bloqueados.join(". ")}.`, 400);
      }
      if (!nuevos.length) {
        return fail(
          res,
          "Ningún reaprovisionamiento cumple: no debe estar anulado ni en otro cargue u hoja de ruta.",
          400
        );
      }
    } else if (tipoDoc === "PEDIDO") {
      const pedidos = await pedidosModel.find({ idEnc: { $in: lista } }).lean();
      const porId = new Map(pedidos.map((pedido) => [String(pedido.idEnc), pedido]));
      for (const idEnc of lista) {
        const bloqueo = bloqueoPedidoEnCargue(ocupacion, idEnc, cargue._id);
        if (bloqueo) {
          bloqueados.push(textoOcupado(idEnc, bloqueo));
          continue;
        }
        const pedido = porId.get(idEnc);
        if (!pedido) continue;
        const snap = snapshotPedido(pedido);
        if (!esAprobado(snap.estado)) continue;
        if (!mismaBodega(snap.bodega, cargue.bodega)) continue;
        nuevos.push(documentoDesdeSnap(snap));
        ocupacion.pedidosEnCargues.set(pedidoClave(idEnc), {
          ambito: "cargue",
          id: String(cargue._id),
          etiqueta: `el cargue ${cargue.idCargue}`,
        });
      }
      if (bloqueados.length && !nuevos.length) {
        return fail(res, `Un pedido no puede repetirse en hojas de ruta ni cargues. ${bloqueados.join(". ")}.`, 400);
      }
      if (!nuevos.length) {
        return fail(
          res,
          "Ningún pedido cumple: debe estar Aprobado, de la bodega del despachador y sin otro cargue u hoja de ruta.",
          400
        );
      }
    } else {
      return fail(res, "Aún no hay catálogo de ese tipo de documento.", 400);
    }
    cargue.documentos.push(...nuevos);
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    await marcarOrigenesEnCargue(nuevos, cargue.idCargue);
    return ok(res, resumenCargue(cargue.toObject()));
  } catch (error) {
    return fail(res, "No se pudieron agregar los documentos.");
  }
};

carguesCtr.eliminarDocumentos = async (req, res) => {
  try {
    const { _id, ids } = req.body || {};
    const cargue = await carguesModel.findById(_id);
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    if (cargue.estado !== "pendiente") {
      return fail(res, "Este cargue ya no se puede editar.", 400);
    }
    const quitar = new Set((Array.isArray(ids) ? ids : []).map(String));
    const quitados = (cargue.documentos || []).filter(
      (doc) => quitar.has(String(doc._id)) || quitar.has(String(doc.idEnc))
    );
    cargue.documentos = (cargue.documentos || []).filter(
      (doc) => !quitar.has(String(doc._id)) && !quitar.has(String(doc.idEnc))
    );
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    await soltarOrigenesDeCargue(quitados);
    return ok(res, resumenCargue(cargue.toObject()));
  } catch (error) {
    return fail(res, "No se pudieron eliminar los documentos.");
  }
};

carguesCtr.enviarADespachos = async (req, res) => {
  try {
    const cargue = await carguesModel.findById(req.params._id);
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    if (cargue.estado !== "pendiente") {
      return fail(res, "Este cargue ya fue enviado.", 400);
    }
    if (!(cargue.documentos || []).length) {
      return fail(res, "Agregue al menos un documento antes de enviar.", 400);
    }
    cargue.estado = "enviado";
    cargue.fecha_envio = new Date();
    cargue.fecha_actualizacion = new Date();
    await cargue.save();
    await hidratarCargue(cargue);
    await marcarOrigenesEnCargue(cargue.documentos, cargue.idCargue);
    return ok(res, resumenCargue(cargue.toObject()));
  } catch (error) {
    return fail(res, "No se pudo enviar el cargue.");
  }
};

carguesCtr.devolverADespachos = async (req, res) => {
  try {
    const cargue = await carguesModel.findById(req.params._id);
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    if (cargue.estado !== "enviado") {
      return fail(res, "Solo se puede devolver un cargue ya enviado a piso.", 400);
    }
    const docs = cargue.documentos || [];
    const cerradoPorDocs =
      docs.length > 0 &&
      docs.every((doc) => {
        const est = String(doc.estadoDespacho || "").toUpperCase();
        return doc.omitido || est === "OMIT" || est === "DESP";
      });
    const progreso = progresoCargue(cargue);
    if (!cerradoPorDocs && progreso.estado !== "COMPLETADO") {
      return fail(res, "Este cargue aún no está finalizado.", 400);
    }
    const reabrirOrigen = [];
    for (const doc of docs) {
      const est = String(doc.estadoDespacho || "").toUpperCase();
      const cerrado = doc.omitido || est === "OMIT" || est === "DESP";
      if (!cerrado) continue;
      if (est === "DESP") reabrirOrigen.push(doc);
      doc.omitido = false;
      doc.motivoOmision = "";
      doc.estadoDespacho = "PEND";
      doc.etiquetasCanasta = [];
    }
    cargue.reabiertoDespacho = true;
    cargue.fecha_actualizacion = new Date();
    cargue.markModified("documentos");
    await cargue.save();
    for (const doc of reabrirOrigen) {
      await marcarOrigenDespachando(doc, cargue.idCargue);
    }
    return ok(res, progresoCargue(cargue.toObject(), { conLineas: true }));
  } catch (error) {
    return fail(res, "No se pudo devolver el cargue a despachos.");
  }
};

carguesCtr.getEstadoCargues = async (_req, res) => {
  try {
    const cargues = await carguesModel
      .find({ estado: "enviado" })
      .sort({ idCargue: -1 })
      .lean();
    return ok(res, cargues.map((c) => progresoCargue(c, { conLineas: false })));
  } catch (error) {
    return fail(res, "No se pudo leer el estado de los cargues.");
  }
};

carguesCtr.getEstadoCargue = async (req, res) => {
  try {
    const cargue = await carguesModel.findById(req.params._id).lean();
    if (!cargue) return fail(res, "No se encontró el cargue.", 404);
    return ok(res, progresoCargue(cargue, { conLineas: true }));
  } catch (error) {
    return fail(res, "No se pudo leer el estado del cargue.");
  }
};

export default carguesCtr;
