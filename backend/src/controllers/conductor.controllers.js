import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { JWT_SECRET } from "../middleware/authHttp";
import vehiculoModel from "../models/vehiculos.models";
import hojaModel from "../models/hojasRuta.models";
import facturasModel from "../models/facturas.models";
import { verifyPassword } from "../seguridad/password";
import { esPlacaCarro, normalizarPlaca } from "../data/vehiculos.catalogo";
import {
  MOTIVOS_NOVEDAD_RUTA,
  esEntregaCompleta,
  esMotivoNoEntrega,
  etiquetaMotivo,
  motivoPorCodigo,
} from "../data/motivosNovedadRuta";
import {
  TIPOS_RECAUDO,
  evaluarRecaudo,
  tipoRecaudoValido,
  etiquetaTipoRecaudo,
  bancoPorTipo,
} from "../data/recaudosRuta";
import {
  BANCOS_CONSIGNACION,
  evaluarLiquidacion,
  facturasPendientes,
  puedeEditarLiquidacion,
  presentarCierre,
  presentarConsignacion,
  presentarLiquidacion,
  sanitizarConsignacion,
} from "../data/liquidacionRuta";
import { leerComprobanteDesdeFoto } from "../services/ocrComprobante.servicios";

const conductorCtr = {};
const MAX_FIRMA = 400000;
const MAX_FOTO = 900000;

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

export const MOTIVOS_ENTREGA = MOTIVOS_NOVEDAD_RUTA;

const fechaHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const variantesPlaca = (placa) => {
  const n = normalizarPlaca(placa);
  const lista = [n];
  if (n.length === 6) lista.push(`${n.slice(0, 3)}-${n.slice(3)}`);
  return [...new Set(lista)];
};

const placaSesion = (req) => {
  const identity = req.user?.identity || {};
  const placa = normalizarPlaca(identity.placa);
  if (!placa || identity.origen !== "conductor") return "";
  return placa;
};

const esFactura = (doc) => {
  const nro = String(doc?.nroFactura || "").trim();
  const tipo = String(doc?.tipoDoc || "").toUpperCase();
  if (!nro) return false;
  if (tipo.includes("REAPRO")) return false;
  return true;
};

const tipoPagoDe = (cndPago) =>
  /cred/i.test(String(cndPago || "")) ? "CREDITO" : "CONTADO";

const resumenEntrega = (doc) => {
  const e = doc?.entrega || {};
  return {
    estado: e.estado || "pendiente",
    alcance: e.alcance || "",
    motivo: e.motivo || "",
    motivoEtiqueta: etiquetaMotivo(e.motivo),
    observacion: e.observacion || "",
    fecha: e.fecha || null,
    nroNovedad: Number(e.nroNovedad) || 0,
    tipoPago: e.tipoPago || "",
    notaCredito: e.notaCredito || "",
    auxiliar: e.auxiliar || "",
    firmaCliente: e.firmaCliente || "",
    firmaTransporte: e.firmaTransporte || "",
    firmaEmpresa: e.firmaEmpresa || "",
  };
};

const totalNovedadDe = (doc) =>
  (doc?.entrega?.lineas || []).reduce((acc, l) => acc + (Number(l.valorNovedad) || 0), 0);

const presentarRecaudo = (row = {}) => ({
  _id: row._id ? String(row._id) : "",
  tipo: row.tipo || "CORRESPONSAL",
  tipoEtiqueta: etiquetaTipoRecaudo(row.tipo),
  monto: Number(row.monto) || 0,
  fecha: row.fecha || "",
  referencia: row.referencia || "",
  recibo: row.recibo || "",
  aprobacion: row.aprobacion || "",
  convenio: row.convenio || "",
  terminal: row.terminal || "",
  codigoUnico: row.codigoUnico || "",
  lugar: row.lugar || "",
  pagador: row.pagador || "",
  nitPagador: row.nitPagador || "",
  beneficiario: row.beneficiario || "",
  nitBeneficiario: row.nitBeneficiario || "",
  cuentaOrigen: row.cuentaOrigen || "",
  cuentaDestino: row.cuentaDestino || "",
  costo: Number(row.costo) || 0,
  banco: row.banco || bancoPorTipo(row.tipo),
  formaPago: row.formaPago || "",
  oficina: row.oficina || "",
  usuarioBanco: row.usuarioBanco || "",
  tipoId: row.tipoId || "",
  numeroId: row.numeroId || "",
  codigoConvenio: row.codigoConvenio || "",
  referencia2: row.referencia2 || "",
  placaTicket: row.placaTicket || "",
  caja: row.caja || "",
  rrn: row.rrn || "",
  foto: row.foto || "",
});

const presentarStop = (doc) => {
  const tipoPago = doc?.entrega?.tipoPago || tipoPagoDe(doc?.cndPago);
  const recaudos = (doc?.recaudos || []).map(presentarRecaudo);
  return {
    docId: String(doc._id),
    nroFactura: doc.nroFactura || "",
    pedidoIdEnc: doc.pedidoIdEnc || "",
    cliente: doc.cliente || "",
    nit: doc.nit || "",
    sucursal: doc.sucursal || "",
    direccion: doc.direccion || "",
    barrio: doc.barrio || "",
    municipio: doc.municipio || "",
    contacto: doc.contacto || "",
    cndPago: doc.cndPago || "",
    valor: Number(doc.valor) || 0,
    peso: Number(doc.peso) || 0,
    entrega: resumenEntrega(doc),
    recaudos,
    recaudo: evaluarRecaudo({
      valorFactura: doc.valor,
      valorNovedad: totalNovedadDe(doc),
      tipoPago,
      recaudos,
    }),
  };
};

const presentarHoja = (hoja) => ({
  _id: String(hoja._id),
  idHoja: hoja.idHoja,
  fecha: hoja.fecha,
  nombre: hoja.nombre,
  placa: hoja.placa,
  conductor: hoja.conductor || "",
  auxiliar: hoja.auxiliar || "",
  estado: hoja.estado,
  cierre: presentarCierre(hoja),
  liquidacion: presentarLiquidacion(hoja),
  consignaciones: (hoja.consignaciones || []).map((row) => presentarConsignacion(row)),
  bancos: BANCOS_CONSIGNACION,
  cruce: evaluarLiquidacion(hoja),
  facturas: (hoja.documentos || []).filter(esFactura).map(presentarStop),
});

const buscarHojas = async (placa) => {
  const placas = variantesPlaca(placa);
  return hojaModel
    .find({
      estado: { $in: ["vigente", "cerrada", "liquidada"] },
      placa: { $in: placas },
    })
    .sort({ fecha: -1, idHoja: -1 })
    .lean();
};

const hojaEditableDePlaca = async (placa, hojaId) => {
  if (!hojaId || !mongoose.isValidObjectId(hojaId)) return null;
  const hoja = await hojaModel.findById(hojaId);
  if (!hoja) return null;
  if (!variantesPlaca(placa).includes(normalizarPlaca(hoja.placa))) return null;
  return hoja;
};

const hojaDePlaca = async (placa, hojaId) => {
  const hojas = await buscarHojas(placa);
  if (!hojas.length) return null;
  if (hojaId && mongoose.isValidObjectId(hojaId)) {
    return hojas.find((h) => String(h._id) === String(hojaId)) || null;
  }
  const hoy = fechaHoy();
  return hojas.find((h) => h.fecha === hoy) || hojas[0];
};

conductorCtr.login = async (req, res) => {
  const placa = normalizarPlaca(req.body?.placa);
  const password = String(req.body?.password || "").trim();
  if (!placa || !password) {
    return fail(res, "Ingrese la placa y la contraseña.", 401);
  }
  if (!esPlacaCarro(placa)) {
    return fail(res, "La placa del carro va sin guiones: 3 letras y 3 números (ejemplo ABC123).", 400);
  }
  try {
    const vehiculo = await vehiculoModel
      .findOne({ placa: { $in: variantesPlaca(placa) }, estado: 0 })
      .select("+passwordHash")
      .lean();
    if (!vehiculo || !vehiculo.passwordHash || !verifyPassword(password, vehiculo.passwordHash)) {
      return fail(res, "Placa o contraseña incorrectos.", 401);
    }
    const identity = {
      nombre: vehiculo.conductor || placa,
      usuario: placa,
      placa,
      vehiculoId: String(vehiculo._id),
      perfil: "Conductor",
      permisos: ["despacho.conductor"],
      puedeFirmar: false,
      origen: "conductor",
    };
    const token = jwt.sign({ identity, sub: identity.nombre, origen: "conductor" }, JWT_SECRET, {
      expiresIn: "12h",
    });
    return res.status(200).json({ token, identity });
  } catch (error) {
    console.error("loginConductor:", error.message);
    return fail(res, "No se pudo iniciar sesión.", 500);
  }
};

conductorCtr.getHojas = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hojas = (await buscarHojas(placa)).map(presentarHoja);
    const hoy = fechaHoy();
    return ok(res, {
      placa,
      conductor: req.user?.identity?.nombre || "",
      hoy,
      hojas,
    });
  } catch (error) {
    console.error("getHojasConductor:", error.message);
    return fail(res, "No se pudo leer la hoja de ruta.", 500);
  }
};

conductorCtr.getHoja = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaDePlaca(placa, req.params.hojaId);
    if (!hoja) return fail(res, "No hay hoja de ruta para esta placa.", 404);
    return ok(res, presentarHoja(hoja));
  } catch (error) {
    console.error("getHojaConductor:", error.message);
    return fail(res, "No se pudo leer la hoja de ruta.", 500);
  }
};

const num = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const lineaCatalogo = (l = {}) => ({
  referencia: l.referencia || "",
  concepto: l.concepto || "",
  um: l.um || "",
  cantidadFactura: num(l.cantidadFactura) || num(l.cantidad) || num(l.unidades) || num(l.kilos),
  kilos: num(l.kilos),
  unidades: num(l.unidades),
  valorBruto: num(l.valorBruto),
});

const fusionarLinea = (base, hit = {}) => ({
  ...base,
  unidadesDevolucion: num(hit.unidadesDevolucion),
  kilosDevolucion: num(hit.kilosDevolucion),
  mermaPct: num(hit.mermaPct),
  kilosMerma: num(hit.kilosMerma),
  unidadesFaltante: num(hit.unidadesFaltante),
  kilosFaltante: num(hit.kilosFaltante),
  valorNovedad: num(hit.valorNovedad),
  motivo: String(hit.motivo || "").trim(),
  observacion: String(hit.observacion || "").trim(),
  cantidadEntregada: num(hit.cantidadEntregada),
});

const qtyNovedad = (l) =>
  Math.max(
    num(l.kilosDevolucion) + num(l.kilosMerma) + num(l.kilosFaltante),
    num(l.unidadesDevolucion) + num(l.unidadesFaltante)
  );

const hayNovedadEnLinea = (l) => qtyNovedad(l) > 0 || num(l.valorNovedad) > 0;

const recortarFoto = (data) => {
  const s = String(data || "").trim();
  if (!s) return "";
  if (!s.startsWith("data:image")) {
    const error = new Error("La foto del comprobante no es válida.");
    error.status = 400;
    throw error;
  }
  if (s.length > MAX_FOTO) {
    const error = new Error("La foto del comprobante es demasiado pesada. Tome de nuevo más cerca o con menos zoom.");
    error.status = 400;
    throw error;
  }
  return s;
};

const sanitizarRecaudo = (row = {}, placa) => {
  const tipo = String(row.tipo || "OTRO").trim().toUpperCase();
  if (!tipoRecaudoValido(tipo)) {
    const error = new Error("No se reconoció el tipo de comprobante.");
    error.status = 400;
    throw error;
  }
  const monto = Math.max(0, num(row.monto));
  const referencia = String(row.referencia || "").trim();
  const recibo = String(row.recibo || "").trim();
  const aprobacion = String(row.aprobacion || "").trim();
  const foto = recortarFoto(row.foto);
  if (monto <= 0) {
    const error = new Error("Indique el monto del recaudo.");
    error.status = 400;
    throw error;
  }
  if (!foto && !referencia && !recibo && !aprobacion) {
    const error = new Error("Adjunte la foto del comprobante o el número de transacción.");
    error.status = 400;
    throw error;
  }
  return {
    tipo,
    monto,
    fecha: String(row.fecha || "").trim(),
    referencia,
    recibo,
    aprobacion,
    convenio: String(row.convenio || "").trim(),
    terminal: String(row.terminal || "").trim(),
    codigoUnico: String(row.codigoUnico || "").trim(),
    lugar: String(row.lugar || "").trim(),
    pagador: String(row.pagador || "").trim(),
    nitPagador: String(row.nitPagador || "").trim(),
    beneficiario: String(row.beneficiario || "").trim(),
    nitBeneficiario: String(row.nitBeneficiario || "").trim(),
    cuentaOrigen: String(row.cuentaOrigen || "").trim(),
    cuentaDestino: String(row.cuentaDestino || "").trim(),
    costo: Math.max(0, num(row.costo)),
    banco: String(row.banco || bancoPorTipo(tipo)).trim() || bancoPorTipo(tipo),
    formaPago: String(row.formaPago || "").trim(),
    oficina: String(row.oficina || "").trim(),
    usuarioBanco: String(row.usuarioBanco || "").trim(),
    tipoId: String(row.tipoId || "").trim(),
    numeroId: String(row.numeroId || "").trim(),
    codigoConvenio: String(row.codigoConvenio || "").trim(),
    referencia2: String(row.referencia2 || "").trim(),
    placaTicket: String(row.placaTicket || "").trim().toUpperCase(),
    caja: String(row.caja || "").trim(),
    rrn: String(row.rrn || "").trim(),
    foto,
    usuario: placa,
    fecha_creacion: row.fecha_creacion || new Date(),
  };
};

const recortarFirma = (data, etiqueta) => {
  const s = String(data || "").trim();
  if (!s) return "";
  if (!s.startsWith("data:image")) {
    const error = new Error(`La firma de ${etiqueta} no es válida.`);
    error.status = 400;
    throw error;
  }
  if (s.length > MAX_FIRMA) {
    const error = new Error(`La firma de ${etiqueta} es demasiado pesada.`);
    error.status = 400;
    throw error;
  }
  return s;
};

const siguienteNroNovedad = async () => {
  const [row] = await hojaModel.aggregate([
    { $unwind: { path: "$documentos", preserveNullAndEmptyArrays: true } },
    { $group: { _id: null, max: { $max: "$documentos.entrega.nroNovedad" } } },
  ]);
  return (Number(row?.max) || 0) + 1;
};

const completarLinea = (base, hit, { motivo, noEntrega, completa }) => {
  const linea = fusionarLinea(base, hit);
  if (completa) {
    return {
      ...linea,
      unidadesDevolucion: 0,
      kilosDevolucion: 0,
      mermaPct: 0,
      kilosMerma: 0,
      unidadesFaltante: 0,
      kilosFaltante: 0,
      valorNovedad: 0,
      motivo,
      cantidadEntregada: base.cantidadFactura,
    };
  }
  if (noEntrega && !hayNovedadEnLinea(linea)) {
    linea.kilosFaltante = base.kilos || 0;
    linea.unidadesFaltante = base.unidades || (base.kilos ? 0 : base.cantidadFactura);
  }
  const kilosNovedad =
    num(linea.kilosDevolucion) + num(linea.kilosMerma) + num(linea.kilosFaltante);
  const undNovedad = num(linea.unidadesDevolucion) + num(linea.unidadesFaltante);
  const kilosEnt = Math.max(0, num(base.kilos) - kilosNovedad);
  const undEnt = Math.max(0, num(base.unidades) - undNovedad);
  linea.cantidadEntregada = base.kilos
    ? kilosEnt
    : undEnt || Math.max(0, base.cantidadFactura - qtyNovedad(linea));
  if (!linea.motivo) linea.motivo = motivo;
  if (!linea.valorNovedad && (kilosNovedad || undNovedad) && base.valorBruto) {
    const denom = base.kilos || base.unidades || base.cantidadFactura || 1;
    const unidades = kilosNovedad || undNovedad;
    linea.valorNovedad = Math.round((base.valorBruto / denom) * unidades);
  }
  if (base.kilos && linea.kilosMerma && !linea.mermaPct) {
    linea.mermaPct = Math.round((linea.kilosMerma / base.kilos) * 10000) / 100;
  }
  return linea;
};

const estadoDesdeLineas = (lineas, motivo) => {
  if (esEntregaCompleta(motivo)) return "entregado";
  if (!lineas.length) return esMotivoNoEntrega(motivo) ? "no_entregado" : "parcial";
  const todasNovedad = lineas.every((l) => {
    const fact = num(l.kilos) || num(l.unidades) || num(l.cantidadFactura);
    if (fact <= 0) return hayNovedadEnLinea(l);
    const nov = num(l.kilos)
      ? num(l.kilosDevolucion) + num(l.kilosMerma) + num(l.kilosFaltante)
      : qtyNovedad(l);
    return nov >= fact - 0.0001;
  });
  const ninguna = lineas.every((l) => !hayNovedadEnLinea(l));
  if (todasNovedad) return "no_entregado";
  if (ninguna && esMotivoNoEntrega(motivo)) return "no_entregado";
  return "parcial";
};

conductorCtr.getFactura = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaDePlaca(placa, req.params.hojaId);
    if (!hoja) return fail(res, "No hay hoja de ruta para esta placa.", 404);
    const doc = (hoja.documentos || []).find((d) => String(d._id) === String(req.params.docId));
    if (!doc || !esFactura(doc)) return fail(res, "No se encontró la factura en esta hoja.", 404);
    const factura = await facturasModel.findOne({ numFactura: String(doc.nroFactura).trim() }).lean();
    const lineas = (factura?.lineas || []).map(lineaCatalogo);
    const entrega = doc.entrega || {};
    const lineasEntrega =
      Array.isArray(entrega.lineas) && entrega.lineas.length
        ? entrega.lineas.map((l) => fusionarLinea(lineaCatalogo(l), l))
        : lineas.map((l) => fusionarLinea(l, {}));
    return ok(res, {
      hoja: {
        _id: String(hoja._id),
        idHoja: hoja.idHoja,
        fecha: hoja.fecha,
        nombre: hoja.nombre,
        placa: hoja.placa,
        conductor: hoja.conductor || "",
        auxiliar: hoja.auxiliar || "",
        estado: hoja.estado,
      },
      stop: presentarStop(doc),
      factura: factura
        ? {
            numFactura: factura.numFactura,
            fecha: factura.fecha,
            valor: factura.valor,
            notas: factura.notas || "",
            cndPago: factura.cndPago || doc.cndPago || "",
          }
        : null,
      lineas,
      entrega: {
        ...resumenEntrega(doc),
        tipoPago: entrega.tipoPago || tipoPagoDe(doc.cndPago || factura?.cndPago),
        auxiliar: entrega.auxiliar || hoja.auxiliar || hoja.conductor || "",
        lineas: lineasEntrega,
      },
      motivos: MOTIVOS_NOVEDAD_RUTA,
      tiposRecaudo: TIPOS_RECAUDO,
    });
  } catch (error) {
    console.error("getFacturaConductor:", error.message);
    return fail(res, "No se pudo leer la factura.", 500);
  }
};

conductorCtr.leerComprobante = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const foto = recortarFoto(req.body?.foto);
    if (!foto) return fail(res, "Tome la foto del comprobante.");
    const leido = await leerComprobanteDesdeFoto(foto);
    return ok(res, leido);
  } catch (error) {
    console.error("leerComprobante:", error.causa || error.message);
    return fail(res, error.message || "No se pudo leer el comprobante.", error.status || 500);
  }
};

conductorCtr.guardarEntrega = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  const { hojaId, docId } = req.params;
  const motivo = String(req.body?.motivo || "").trim().toUpperCase();
  const observacion = String(req.body?.observacion || "").trim();
  const tipoPago = /cred/i.test(String(req.body?.tipoPago || "")) ? "CREDITO" : "CONTADO";
  const notaCredito = String(req.body?.notaCredito || "").trim();
  if (!motivoPorCodigo(motivo)) {
    return fail(res, "Seleccione el motivo de la novedad.", 400);
  }
  try {
    const hoja = await hojaModel.findById(hojaId);
    if (!hoja) return fail(res, "No hay hoja de ruta vigente.", 404);
    if (hoja.estado !== "vigente") {
      return fail(res, "La ruta ya está cerrada. No se pueden editar entregas.");
    }
    if (!variantesPlaca(placa).includes(normalizarPlaca(hoja.placa))) {
      return fail(res, "Esta hoja no pertenece a su placa.", 403);
    }
    const doc = hoja.documentos.id(docId);
    if (!doc || !esFactura(doc)) return fail(res, "No se encontró la factura en esta hoja.", 404);

    const factura = await facturasModel.findOne({ numFactura: String(doc.nroFactura).trim() }).lean();
    const catalogo = (factura?.lineas || []).map(lineaCatalogo);
    const recibidas = Array.isArray(req.body?.lineas) ? req.body.lineas : [];
    const completa = esEntregaCompleta(motivo);
    const noEntrega = esMotivoNoEntrega(motivo);
    const lineas = (catalogo.length ? catalogo : recibidas.map(lineaCatalogo)).map((base, i) => {
      const hit =
        recibidas.find((r) => String(r?.referencia || "") === base.referencia) || recibidas[i] || {};
      return completarLinea(base, hit, { motivo, noEntrega, completa });
    });

    if (!completa && !lineas.some(hayNovedadEnLinea) && !noEntrega) {
      return fail(res, "Indique devolución, merma o faltante en al menos un producto.", 400);
    }

    let nroNovedad = Number(doc.entrega?.nroNovedad) || 0;
    let firmaCliente = recortarFirma(req.body?.firmaCliente, "cliente");
    let firmaTransporte = recortarFirma(req.body?.firmaTransporte, "transporte");
    let firmaEmpresa = recortarFirma(req.body?.firmaEmpresa, "empresa");
    if (!completa) {
      if (!nroNovedad) nroNovedad = await siguienteNroNovedad();
      if (!firmaCliente) return fail(res, "El cliente debe firmar el documento de novedades.", 400);
      if (!firmaTransporte) return fail(res, "Firme como transporte / auxiliar.", 400);
    } else {
      firmaCliente = firmaCliente || doc.entrega?.firmaCliente || "";
      firmaTransporte = firmaTransporte || doc.entrega?.firmaTransporte || "";
      firmaEmpresa = firmaEmpresa || doc.entrega?.firmaEmpresa || "";
    }

    const valorNovedad = lineas.reduce((acc, l) => acc + num(l.valorNovedad), 0);
    const recaudos = (Array.isArray(req.body?.recaudos) ? req.body.recaudos : []).map((row) =>
      sanitizarRecaudo(row, placa)
    );
    const cruce = evaluarRecaudo({
      valorFactura: doc.valor,
      valorNovedad,
      tipoPago,
      recaudos,
    });
    if (!cruce.credito && cruce.esperado > 0 && !recaudos.length) {
      return fail(res, "En facturas de contado adjunte el comprobante de recaudo (foto o número de transacción).");
    }

    doc.entrega = {
      estado: estadoDesdeLineas(lineas, motivo),
      alcance: completa ? "factura" : "items",
      motivo,
      observacion,
      usuario: placa,
      fecha: new Date(),
      nroNovedad,
      tipoPago,
      notaCredito,
      auxiliar: String(req.body?.auxiliar || hoja.auxiliar || hoja.conductor || "").trim(),
      firmaCliente,
      firmaTransporte,
      firmaEmpresa,
      lineas,
    };
    doc.recaudos = recaudos;
    hoja.fecha_actualizacion = new Date();
    hoja.markModified("documentos");
    await hoja.save();
    return ok(res, presentarStop(doc.toObject ? doc.toObject() : doc));
  } catch (error) {
    console.error("guardarEntregaConductor:", error.message);
    return fail(res, error.message || "No se pudo guardar la novedad.", error.status || 500);
  }
};

conductorCtr.cerrarRuta = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaEditableDePlaca(placa, req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "liquidada") return fail(res, "Esta ruta ya está liquidada.");
    if (hoja.estado === "cerrada") return ok(res, presentarHoja(hoja.toObject()));
    if (hoja.estado !== "vigente") return fail(res, "Solo se cierra una hoja vigente.");
    const pendientes = facturasPendientes(hoja);
    if (pendientes.length) {
      return fail(
        res,
        `Aún hay ${pendientes.length} factura(s) sin entrega. Complete todas antes de cerrar la ruta.`
      );
    }
    hoja.estado = "cerrada";
    hoja.cierre = {
      fecha: new Date(),
      usuario: placa,
      observaciones: String(req.body?.observaciones || "").trim(),
    };
    if (!hoja.liquidacion) hoja.liquidacion = {};
    if (!hoja.liquidacion.estado || hoja.liquidacion.estado === "paz_y_salvo") {
      hoja.liquidacion.estado = "sin_liquidar";
    }
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, presentarHoja(hoja.toObject()));
  } catch (error) {
    console.error("cerrarRutaConductor:", error.message);
    return fail(res, error.message || "No se pudo cerrar la ruta.", error.status || 500);
  }
};

conductorCtr.agregarConsignacion = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaEditableDePlaca(placa, req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada") {
      return fail(res, "Cierre la ruta antes de registrar consignaciones.");
    }
    if (!puedeEditarLiquidacion(hoja)) {
      return fail(res, "Esta liquidación ya está en paz y salvo.");
    }
    hoja.consignaciones.push(sanitizarConsignacion(req.body, { usuario: placa, origen: "conductor" }));
    if (hoja.liquidacion?.estado === "pendiente") hoja.liquidacion.estado = "sin_liquidar";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, presentarHoja(hoja.toObject()), 201);
  } catch (error) {
    console.error("agregarConsignacionConductor:", error.message);
    return fail(res, error.message || "No se pudo agregar la consignación.", error.status || 500);
  }
};

conductorCtr.eliminarConsignacion = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaEditableDePlaca(placa, req.params.hojaId);
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
    return ok(res, presentarHoja(hoja.toObject()));
  } catch (error) {
    console.error("eliminarConsignacionConductor:", error.message);
    return fail(res, error.message || "No se pudo borrar la consignación.", error.status || 500);
  }
};

conductorCtr.enviarLiquidacion = async (req, res) => {
  const placa = placaSesion(req);
  if (!placa) return fail(res, "Esta sesión no es de conductor.", 403);
  try {
    const hoja = await hojaEditableDePlaca(placa, req.params.hojaId);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "cerrada") return fail(res, "Cierre la ruta antes de enviar a liquidar.");
    if (!puedeEditarLiquidacion(hoja)) return fail(res, "Esta liquidación ya está en paz y salvo.");
    hoja.liquidacion = {
      ...(hoja.liquidacion?.toObject ? hoja.liquidacion.toObject() : hoja.liquidacion || {}),
      gastosOperativos: Math.max(0, num(req.body?.gastosOperativos)),
      monedas: Math.max(0, num(req.body?.monedas)),
      observaciones: String(req.body?.observaciones || "").trim(),
      estado: "pendiente",
    };
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, presentarHoja(hoja.toObject()));
  } catch (error) {
    console.error("enviarLiquidacionConductor:", error.message);
    return fail(res, error.message || "No se pudo enviar la liquidación.", error.status || 500);
  }
};

export default conductorCtr;
