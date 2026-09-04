import mongoose from "mongoose";
import hojaModel from "../models/hojasRuta.models";
import bodegaModel from "../models/bodega.models";
import {
  BANCOS_CONSIGNACION,
  centroDeHoja,
  devolucionesDe,
  esFactura,
  evaluarLiquidacion,
  facturasPendientes,
  puedeEditarLiquidacion,
  presentarCierre,
  presentarConsignacion,
  presentarLiquidacion,
  sanitizarConsignacion,
} from "../data/liquidacionRuta";
import {
  MOTIVOS_NOVEDAD_RUTA,
  esEntregaCompleta,
  esMotivoNoEntrega,
  etiquetaMotivo,
  motivoPorCodigo,
} from "../data/motivosNovedadRuta";

const liquidacionCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const fechaHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const usuarioDe = (req) =>
  req.user?.identity?.nombre || req.user?.identity?.usuario || req.user?.sub || "oficina";

const ESTADOS_ACTIVOS = ["vigente", "cerrada", "liquidada"];

const cargarHojasFecha = (fecha) =>
  hojaModel
    .find({ fecha, estado: { $in: ESTADOS_ACTIVOS } })
    .sort({ placa: 1, idHoja: 1 });

const mapaBodegas = async () => {
  const rows = await bodegaModel.find({ estado: 0 }, { codigo: 1, nombre: 1 }).lean();
  const map = new Map();
  for (const b of rows) {
    map.set(String(b.codigo || "").trim(), b.nombre || b.codigo);
    map.set(String(b.nombre || "").trim().toUpperCase(), b.nombre);
  }
  map.set("SIN BODEGA", "SIN BODEGA");
  return map;
};

const nombreCentro = (codigo, mapa) => {
  const key = String(codigo || "SIN BODEGA").trim();
  return mapa.get(key) || mapa.get(key.toUpperCase()) || key;
};

const presentarFacturaCierre = (doc) => {
  const e = doc.entrega || {};
  return {
    docId: String(doc._id),
    nroFactura: doc.nroFactura || "",
    cliente: doc.cliente || "",
    direccion: doc.direccion || "",
    barrio: doc.barrio || "",
    municipio: doc.municipio || "",
    kilos: Number(doc.peso) || 0,
    valor: Number(doc.valor) || 0,
    cndPago: doc.cndPago || "",
    tipoPago: e.tipoPago || "",
    estado: e.estado || "pendiente",
    motivo: e.motivo || "",
    motivoEtiqueta: etiquetaMotivo(e.motivo),
    observacion: e.observacion || "",
    hora: e.fecha || null,
    nroNovedad: Number(e.nroNovedad) || 0,
    valorNovedad: (e.lineas || []).reduce((acc, l) => acc + (Number(l.valorNovedad) || 0), 0),
  };
};

const resumenHoja = (hoja, mapa) => {
  const cruce = evaluarLiquidacion(hoja);
  const centro = centroDeHoja(hoja);
  return {
    _id: String(hoja._id),
    idHoja: hoja.idHoja,
    fecha: hoja.fecha,
    nombre: hoja.nombre,
    placa: hoja.placa,
    conductor: hoja.conductor || "",
    auxiliar: hoja.auxiliar || "",
    estado: hoja.estado,
    centro,
    centroNombre: nombreCentro(centro, mapa),
    cierre: presentarCierre(hoja),
    liquidacion: presentarLiquidacion(hoja),
    consignaciones: (hoja.consignaciones || []).map((row) =>
      presentarConsignacion(row, { conFoto: false })
    ),
    cruce,
    facturas: (hoja.documentos || []).filter(esFactura).map(presentarFacturaCierre),
    devoluciones: devolucionesDe(hoja),
    novedades: (hoja.documentos || []).filter(esFactura).filter((d) => {
      const est = String(d.entrega?.estado || "pendiente").toLowerCase();
      return est === "parcial" || est === "no_entregado";
    }).length,
  };
};

const detalleHoja = (hoja, mapa) => {
  const base = resumenHoja(hoja, mapa);
  return {
    ...base,
    consignaciones: (hoja.consignaciones || []).map((row) =>
      presentarConsignacion(row, { conFoto: true })
    ),
    bancos: BANCOS_CONSIGNACION,
    motivos: MOTIVOS_NOVEDAD_RUTA,
  };
};

liquidacionCtr.getAvance = async (req, res) => {
  const fecha = String(req.query.fecha || fechaHoy()).slice(0, 10);
  try {
    const [hojas, mapa] = await Promise.all([cargarHojasFecha(fecha).lean(), mapaBodegas()]);
    const filas = hojas.map((h) => resumenHoja(h, mapa));
    const kpis = filas.reduce(
      (acc, f) => {
        acc.placas += 1;
        acc.despachado += f.cruce.despachado;
        acc.ejecutado += f.cruce.ejecutado;
        acc.devuelto += f.cruce.devuelto;
        acc.consignado += f.cruce.consignado;
        acc.pendiente += Math.max(0, f.cruce.pendiente);
        acc.pazYSalvo += f.liquidacion.estado === "paz_y_salvo" ? 1 : 0;
        return acc;
      },
      { placas: 0, despachado: 0, ejecutado: 0, devuelto: 0, consignado: 0, pendiente: 0, pazYSalvo: 0 }
    );
    const gruposMap = new Map();
    for (const fila of filas) {
      const key = fila.centroNombre;
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          centro: fila.centro,
          nombre: key,
          placas: 0,
          despachado: 0,
          ejecutado: 0,
          devuelto: 0,
          consignado: 0,
          pendiente: 0,
          entregados: 0,
          pedidos: 0,
          filas: [],
        });
      }
      const g = gruposMap.get(key);
      g.placas += 1;
      g.despachado += fila.cruce.despachado;
      g.ejecutado += fila.cruce.ejecutado;
      g.devuelto += fila.cruce.devuelto;
      g.consignado += fila.cruce.consignado;
      g.pendiente += Math.max(0, fila.cruce.pendiente);
      g.entregados += fila.cruce.entregados;
      g.pedidos += fila.cruce.pedidos;
      g.filas.push({
        _id: fila._id,
        placa: fila.placa,
        conductor: fila.conductor,
        ruta: fila.nombre,
        pedidos: fila.cruce.pedidos,
        entregados: fila.cruce.entregados,
        cumplimiento: fila.cruce.cumplimiento,
        despachado: fila.cruce.despachado,
        ejecutado: fila.cruce.ejecutado,
        devuelto: fila.cruce.devuelto,
        consignado: fila.cruce.consignado,
        pendiente: fila.cruce.pendiente,
        estado: fila.estado,
        estadoLiquidacion: fila.liquidacion.estado,
        alarma: fila.cruce.alarma,
      });
    }
    const grupos = [...gruposMap.values()].map((g) => ({
      ...g,
      avance: g.pedidos ? Math.round((g.entregados / g.pedidos) * 100) : 0,
    }));
    return ok(res, {
      fecha,
      actualizado: new Date().toISOString(),
      kpis,
      grupos,
    });
  } catch (error) {
    console.error("getAvanceLiquidacion:", error.message);
    return fail(res, "No se pudo leer el avance del día.", 500);
  }
};

liquidacionCtr.getHojas = async (req, res) => {
  const fecha = String(req.query.fecha || fechaHoy()).slice(0, 10);
  const bodega = String(req.query.bodega || "").trim();
  try {
    const [hojas, mapa] = await Promise.all([cargarHojasFecha(fecha).lean(), mapaBodegas()]);
    const todas = hojas.map((h) => resumenHoja(h, mapa));
    const centrosMap = new Map();
    for (const f of todas) {
      if (!centrosMap.has(f.centroNombre)) {
        centrosMap.set(f.centroNombre, { codigo: f.centro, nombre: f.centroNombre });
      }
    }
    const filas =
      bodega && bodega !== "TODOS"
        ? todas.filter((f) => f.centro === bodega || f.centroNombre === bodega)
        : todas;
    return ok(res, {
      fecha,
      bancos: BANCOS_CONSIGNACION,
      motivos: MOTIVOS_NOVEDAD_RUTA,
      centros: [{ codigo: "TODOS", nombre: "TODOS" }, ...centrosMap.values()],
      hojas: filas,
    });
  } catch (error) {
    console.error("getHojasLiquidacion:", error.message);
    return fail(res, "No se pudieron leer las hojas.", 500);
  }
};

liquidacionCtr.getHoja = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.hojaId)) {
      return fail(res, "Hoja inválida.", 400);
    }
    const [hoja, mapa] = await Promise.all([
      hojaModel.findById(req.params.hojaId).lean(),
      mapaBodegas(),
    ]);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    return ok(res, detalleHoja(hoja, mapa));
  } catch (error) {
    console.error("getHojaLiquidacion:", error.message);
    return fail(res, "No se pudo leer la hoja.", 500);
  }
};

liquidacionCtr.guardarCierre = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "anulada" || hoja.estado === "temporal") {
      return fail(res, "Esta hoja no está en ruta.");
    }
    if (hoja.estado === "liquidada") {
      return fail(res, "Esta ruta ya está liquidada.");
    }
    const docs = Array.isArray(req.body?.documentos) ? req.body.documentos : [];
    for (const row of docs) {
      const doc = hoja.documentos.id(row.docId);
      if (!doc || !esFactura(doc)) continue;
      const motivo = String(row.motivo || doc.entrega?.motivo || "").trim().toUpperCase();
      if (motivo && !motivoPorCodigo(motivo)) {
        return fail(res, `Motivo no válido en factura ${doc.nroFactura}.`);
      }
      let estado = String(row.estado || doc.entrega?.estado || "pendiente").toLowerCase();
      if (motivo && esEntregaCompleta(motivo)) estado = "entregado";
      else if (motivo && esMotivoNoEntrega(motivo) && estado === "pendiente") estado = "no_entregado";
      else if (motivo && estado === "pendiente") estado = "parcial";
      doc.entrega = {
        ...(doc.entrega?.toObject ? doc.entrega.toObject() : doc.entrega || {}),
        estado,
        motivo: motivo || doc.entrega?.motivo || "",
        observacion: String(row.observacion ?? doc.entrega?.observacion ?? "").trim(),
        usuario: doc.entrega?.usuario || usuarioDe(req),
        fecha: doc.entrega?.fecha || new Date(),
      };
    }
    const finalizada = req.body?.rutaFinalizada !== false && req.body?.rutaFinalizada !== "false";
    if (finalizada) {
      const pendientes = facturasPendientes(hoja);
      if (pendientes.length) {
        return fail(
          res,
          `Aún hay ${pendientes.length} factura(s) pendiente(s). Indique la novedad o desmarque el cierre.`
        );
      }
      if (hoja.estado === "vigente") {
        hoja.estado = "cerrada";
        hoja.cierre = {
          fecha: new Date(),
          usuario: usuarioDe(req),
          observaciones: String(req.body?.observaciones || hoja.cierre?.observaciones || "").trim(),
        };
      }
    } else if (hoja.estado === "cerrada" && puedeEditarLiquidacion(hoja)) {
      hoja.estado = "vigente";
    }
    hoja.markModified("documentos");
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa));
  } catch (error) {
    console.error("guardarCierreLiquidacion:", error.message);
    return fail(res, error.message || "No se pudo guardar el cierre.", error.status || 500);
  }
};

liquidacionCtr.agregarConsignacion = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada") return fail(res, "La ruta debe estar cerrada para consignar.");
    if (!puedeEditarLiquidacion(hoja)) return fail(res, "Esta liquidación ya está en paz y salvo.");
    hoja.consignaciones.push(
      sanitizarConsignacion(req.body, { usuario: usuarioDe(req), origen: "analista" })
    );
    if (hoja.liquidacion?.estado === "pendiente") hoja.liquidacion.estado = "sin_liquidar";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa), 201);
  } catch (error) {
    console.error("agregarConsignacionOficina:", error.message);
    return fail(res, error.message || "No se pudo agregar la consignación.", error.status || 500);
  }
};

liquidacionCtr.eliminarConsignacion = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada" || !puedeEditarLiquidacion(hoja)) {
      return fail(res, "No se puede borrar consignaciones de esta liquidación.");
    }
    const row = hoja.consignaciones.id(req.params.consignacionId);
    if (!row) return fail(res, "No se encontró la consignación.", 404);
    row.deleteOne();
    if (hoja.liquidacion?.estado === "pendiente") hoja.liquidacion.estado = "sin_liquidar";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa));
  } catch (error) {
    console.error("eliminarConsignacionOficina:", error.message);
    return fail(res, error.message || "No se pudo borrar la consignación.", error.status || 500);
  }
};

liquidacionCtr.guardarGastos = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada") return fail(res, "La ruta debe estar cerrada.");
    if (!puedeEditarLiquidacion(hoja)) return fail(res, "Esta liquidación ya está en paz y salvo.");
    hoja.liquidacion = {
      ...(hoja.liquidacion?.toObject ? hoja.liquidacion.toObject() : hoja.liquidacion || {}),
      gastosOperativos: Math.max(0, Number(req.body?.gastosOperativos) || 0),
      monedas: Math.max(0, Number(req.body?.monedas) || 0),
      observaciones: String(req.body?.observaciones || "").trim(),
      estado: hoja.liquidacion?.estado === "paz_y_salvo" ? "paz_y_salvo" : hoja.liquidacion?.estado || "sin_liquidar",
    };
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa));
  } catch (error) {
    console.error("guardarGastosLiquidacion:", error.message);
    return fail(res, error.message || "No se pudieron guardar los gastos.", error.status || 500);
  }
};

liquidacionCtr.aprobar = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada") return fail(res, "La ruta debe estar cerrada para liquidar.");
    if (hoja.liquidacion?.estado === "paz_y_salvo") {
      return fail(res, "Esta liquidación ya está en paz y salvo.");
    }
    hoja.liquidacion = {
      ...(hoja.liquidacion?.toObject ? hoja.liquidacion.toObject() : hoja.liquidacion || {}),
      gastosOperativos: Math.max(
        0,
        Number(req.body?.gastosOperativos ?? hoja.liquidacion?.gastosOperativos) || 0
      ),
      monedas: Math.max(0, Number(req.body?.monedas ?? hoja.liquidacion?.monedas) || 0),
      observaciones: String(req.body?.observaciones ?? hoja.liquidacion?.observaciones ?? "").trim(),
      estado: "paz_y_salvo",
      aprobadoPor: usuarioDe(req),
      fechaAprobacion: new Date(),
    };
    hoja.estado = "liquidada";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa));
  } catch (error) {
    console.error("aprobarLiquidacion:", error.message);
    return fail(res, error.message || "No se pudo aprobar la liquidación.", error.status || 500);
  }
};

liquidacionCtr.rechazar = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "liquidada" && hoja.liquidacion?.estado === "paz_y_salvo") {
      return fail(res, "Una liquidación en paz y salvo no se rechaza.");
    }
    if (hoja.estado !== "cerrada" && hoja.estado !== "liquidada") {
      return fail(res, "La ruta no está en liquidación.");
    }
    hoja.liquidacion = {
      ...(hoja.liquidacion?.toObject ? hoja.liquidacion.toObject() : hoja.liquidacion || {}),
      observaciones: String(req.body?.observaciones ?? hoja.liquidacion?.observaciones ?? "").trim(),
      estado: "rechazada",
      aprobadoPor: "",
      fechaAprobacion: null,
    };
    hoja.estado = "cerrada";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    const mapa = await mapaBodegas();
    return ok(res, detalleHoja(hoja.toObject(), mapa));
  } catch (error) {
    console.error("rechazarLiquidacion:", error.message);
    return fail(res, error.message || "No se pudo rechazar la liquidación.", error.status || 500);
  }
};

liquidacionCtr.getHistorico = async (req, res) => {
  const fecha = String(req.query.fecha || fechaHoy()).slice(0, 10);
  const placa = String(req.query.placa || "").trim().toUpperCase();
  try {
    const filtro = { fecha, consignaciones: { $exists: true, $ne: [] } };
    if (placa && placa !== "TODAS") filtro.placa = placa;
    const hojas = await hojaModel
      .find(filtro, { placa: 1, fecha: 1, nombre: 1, conductor: 1, consignaciones: 1, estado: 1 })
      .sort({ placa: 1 })
      .lean();
    const items = [];
    for (const hoja of hojas) {
      for (const row of hoja.consignaciones || []) {
        items.push({
          ...presentarConsignacion(row, { conFoto: true }),
          placa: hoja.placa,
          ruta: hoja.nombre,
          conductor: hoja.conductor || "",
          hojaId: String(hoja._id),
          fechaHoja: hoja.fecha,
        });
      }
    }
    const placas = [...new Set(hojas.map((h) => h.placa))].sort();
    const total = items.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
    return ok(res, {
      fecha,
      placa: placa || "TODAS",
      placas,
      total,
      items,
    });
  } catch (error) {
    console.error("getHistoricoLiquidacion:", error.message);
    return fail(res, "No se pudo leer el histórico.", 500);
  }
};

export default liquidacionCtr;
