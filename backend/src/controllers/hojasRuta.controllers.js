import mongoose from "mongoose";
import hojaModel from "../models/hojasRuta.models";
import carguesModel from "../models/cargues.models";
import vehiculoModel from "../models/vehiculos.models";
import { sembrarVehiculos } from "./vehiculos.controllers";
import { kgDeToneladas, toneladasDeCapacidad } from "../data/vehiculos.catalogo";
import facturasModel from "../models/facturas.models";
import pedidosModel from "../models/pedidos.models";
import siesaFacturas from "../services/siesaFacturas.servicios";
import { armarImpresionHoja } from "../services/hojaImpresion.servicios";
import { cargarSnapshotFirmante } from "./firmantes.controllers";
import {
  bloqueoFacturaEnHoja,
  bloqueoPedidoEnHoja,
  claveFactura,
  ocupacionDocumentos,
  pedidoClave,
  textoOcupado,
} from "../services/documentosOcupados.servicios";

const hojaCtr = {};

const ESTADOS = ["temporal", "vigente", "cerrada", "liquidada", "anulada"];

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

const snapshotVehiculo = (vehiculo = {}) => ({
  placa: String(vehiculo.placa || "").toUpperCase(),
  conductor: vehiculo.conductor || "",
  telefono: vehiculo.telefono || "",
  capacidad: toneladasDeCapacidad(vehiculo.capacidad),
  celularPtoContacto: vehiculo.celularPtoContacto || "",
  transportadora: vehiculo.transportadora || "",
});

const lineaDesdeDespacho = (doc, cargue, extras = {}) => {
  const peso = Number(doc.peso) || 0;
  const destare = Number(extras.destare) || 0;
  return {
    pedidoIdEnc: String(doc.idEnc || extras.pedidoIdEnc || ""),
    tipoDoc: extras.tipoDoc || "FACTURA",
    tipoDocto: extras.tipoDocto || doc.tipoDocto || "",
    nroFactura: String(extras.nroFactura || doc.nroDoc || "").trim(),
    cliente: doc.cliente || "",
    nit: doc.nit || "",
    sucursal: doc.sucursal || "",
    barrio: doc.barrio || "",
    municipio: doc.municipio || "",
    direccion: doc.direccion || "",
    contacto: doc.sucursal || "",
    cndPago: doc.cndPago || "",
    valor: Number(doc.valor) || 0,
    peso,
    pesoDetTara: Number((peso - destare).toFixed(2)),
    destare,
    bodega: doc.bodega || cargue.bodega || "",
    idCargue: cargue.idCargue,
    cargueId: String(cargue._id),
  };
};

const aplicarFirmantes = async (hoja, body = {}) => {
  if (Object.prototype.hasOwnProperty.call(body, "firmanteCalidadId")) {
    const id = String(body.firmanteCalidadId || "").trim();
    hoja.firmanteCalidad = id ? await cargarSnapshotFirmante(id, "AUXILIAR_CALIDAD") : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "firmanteLogisticaId")) {
    const id = String(body.firmanteLogisticaId || "").trim();
    hoja.firmanteLogistica = id ? await cargarSnapshotFirmante(id, "SUPERVISOR_LOGISTICA") : null;
  }
};

const usuarioDe = (req) => {
  const identity = req.user?.identity || {};
  return String(identity.nombre || identity.usuario || "Administrador").trim();
};

const siguienteIdHoja = async () => {
  const ultimo = await hojaModel.findOne().sort({ idHoja: -1 }).lean();
  return (ultimo?.idHoja || 81000) + 1;
};

const resumen = (hoja) => {
  const documentos = hoja.documentos || [];
  const peso = documentos.reduce((acc, doc) => acc + (Number(doc.pesoDetTara ?? doc.peso) || 0), 0);
  const valor = documentos.reduce((acc, doc) => acc + (Number(doc.valor) || 0), 0);
  const destare = documentos.reduce((acc, doc) => acc + (Number(doc.destare) || 0), 0);
  const pesoAdicional = Number(hoja.pesoAdicional) || 0;
  const capacidadTon = toneladasDeCapacidad(hoja.capacidad);
  const capacidadKg = kgDeToneladas(capacidadTon);
  const pesoCargado = Number((peso + destare + pesoAdicional).toFixed(2));
  const usoPorcentaje = capacidadKg > 0 ? Number(((pesoCargado / capacidadKg) * 100).toFixed(1)) : 0;
  return {
    ...hoja,
    capacidad: capacidadTon,
    totalDocumentos: documentos.length,
    totalPeso: Number(peso.toFixed(2)),
    totalValor: Number(valor.toFixed(2)),
    totalDestare: Number(destare.toFixed(2)),
    capacidadKg,
    pesoCargado,
    usoPorcentaje,
  };
};

const lineaDesdeFactura = (factura) => {
  const peso = Number(factura.peso) || 0;
  return {
    pedidoIdEnc: String(factura.numPedido || factura.nroDoc || factura.id430 || factura.numFactura || ""),
    tipoDoc: factura.tipoDocPedido || factura.tipoDoc || "FACTURA",
    tipoDocto: factura.tipoDocPedido || factura.tipoDocto || "",
    nroFactura: String(factura.numFactura || "").trim(),
    cliente: factura.razonSocial || factura.cliente || "",
    nit: factura.nit || "",
    sucursal: factura.sucursal || "",
    barrio: factura.barrio || "",
    municipio: factura.municipio || "",
    direccion: factura.direccion || "",
    contacto: factura.contacto || "",
    cndPago: factura.cndPago || "",
    valor: Number(factura.valor) || 0,
    peso,
    pesoDetTara: peso,
    destare: 0,
    bodega: factura.bodega || "",
    idCargue: null,
    cargueId: "",
  };
};

const cumpleFiltroTexto = (valor, q) => {
  if (!q) return true;
  return String(valor || "").toLowerCase().includes(String(q).toLowerCase());
};

const persistirFacturas = async (facturas) => {
  if (!facturas.length) return;
  const ops = facturas
    .filter((item) => item.numFactura)
    .map((item) => {
      const { _id, __v, ...resto } = item;
      return {
        updateOne: {
          filter: { numFactura: resto.numFactura },
          update: { $set: { ...resto, fecha_sincronizacion: new Date() } },
          upsert: true,
        },
      };
    });
  if (ops.length) await facturasModel.bulkWrite(ops, { ordered: false });
};

const enriquecerConPedidos = async (facturas) => {
  const pedidosClave = [
    ...new Set(
      facturas
        .flatMap((item) => [item.numPedido, item.nroDoc, item.id430])
        .map((v) => String(v || "").trim())
        .filter((v) => v && v !== "0")
    ),
  ];
  if (!pedidosClave.length) return facturas;
  const pedidos = await pedidosModel
    .find({ idEnc: { $in: pedidosClave } }, { siesa: 0, lineas: 0 })
    .lean();
  const porId = new Map(pedidos.map((pedido) => [String(pedido.idEnc), pedido]));
  return facturas.map((item) => {
    const pedido =
      porId.get(String(item.numPedido || "")) ||
      porId.get(String(item.nroDoc || "")) ||
      porId.get(String(item.id430 || ""));
    if (!pedido) return { ...item, pedidoLocal: false };
    return {
      ...item,
      pedidoLocal: true,
      contacto: item.contacto || pedido.contacto || "",
      barrio: item.barrio || pedido.barrioPed || pedido.barrio || "",
      municipio: item.municipio || pedido.municipio || "",
      bodega: item.bodega && item.bodega !== "SIN_BODEGA" ? item.bodega : pedido.bodega || item.bodega || "",
      vendedor: item.vendedor || pedido.vendedor || pedido.codigo || "",
      tipoDocPedido: item.tipoDocPedido || pedido.tipoDocto || "PEDIDO",
    };
  });
};

hojaCtr.getHojas = async (req, res) => {
  try {
    const estado = String(req.query.estado || "vigente").toLowerCase();
    const filtro = { estado: ESTADOS.includes(estado) ? estado : "vigente" };
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    const nombre = String(req.query.nombre || "").trim();
    const placa = String(req.query.placa || "").trim();
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = hasta;
    }
    if (nombre) filtro.nombre = { $regex: nombre, $options: "i" };
    if (placa) filtro.placa = { $regex: placa, $options: "i" };

    const body = await hojaModel
      .find(filtro, { documentos: 0 })
      .sort({ idHoja: -1 })
      .lean();
    return ok(res, body);
  } catch (error) {
    console.error("getHojas:", error.message);
    return fail(res, "No se pudieron leer las hojas de ruta.", 500);
  }
};

hojaCtr.getHoja = async (req, res) => {
  try {
    const body = await hojaModel.findById(req.params._id).lean();
    if (!body) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (!body.conductor && body.placa) {
      const vehiculo = await vehiculoModel.findOne({ placa: body.placa, estado: 0 }).lean();
      if (vehiculo) Object.assign(body, snapshotVehiculo(vehiculo));
    }
    return ok(res, resumen(body));
  } catch (error) {
    console.error("getHoja:", error.message);
    return fail(res, "No se pudo leer la hoja de ruta.", 500);
  }
};

hojaCtr.getImpresion = async (req, res) => {
  try {
    const body = await hojaModel.findById(req.params._id).lean();
    if (!body) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (!body.conductor && body.placa) {
      const vehiculo = await vehiculoModel.findOne({ placa: body.placa, estado: 0 }).lean();
      if (vehiculo) Object.assign(body, snapshotVehiculo(vehiculo));
    }
    const impresion = await armarImpresionHoja(body);
    return ok(res, impresion);
  } catch (error) {
    console.error("getImpresion hoja:", error.message);
    return fail(res, "No se pudo armar la impresión.", 500);
  }
};

hojaCtr.postHoja = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const placa = String(req.body?.placa || "").trim().toUpperCase();
    const fecha = String(req.body?.fecha || "").slice(0, 10) || fechaHoy();
    const pesoAdicional = Number(req.body?.pesoAdicional);
    const temperatura = String(req.body?.temperatura ?? "").trim();
    if (!placa) return fail(res, "Seleccione el vehículo.");
    if (!nombre) return fail(res, "El nombre de la ruta es obligatorio.");
    await sembrarVehiculos();
    const vehiculo = await vehiculoModel.findOne({ placa, estado: 0 }).lean();
    if (!vehiculo) return fail(res, "El vehículo no existe.");
    const hoja = new hojaModel({
      idHoja: await siguienteIdHoja(),
      fecha,
      usuario: usuarioDe(req),
      nombre,
      ...snapshotVehiculo(vehiculo),
      pesoAdicional: Number.isFinite(pesoAdicional) ? pesoAdicional : 0,
      temperatura,
      estado: "temporal",
    });
    try {
      await aplicarFirmantes(hoja, req.body || {});
    } catch (error) {
      return fail(res, error.message, error.status || 400);
    }
    const body = await hoja.save();
    return ok(res, resumen(body.toObject()));
  } catch (error) {
    console.error("postHoja:", error.message);
    return fail(res, "No se pudo crear la hoja de ruta.", 500);
  }
};

hojaCtr.getDocumentosDisponibles = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.query.hojaId).lean();
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "anulada") return fail(res, "Esta hoja está anulada.", 400);

    const ocupacion = await ocupacionDocumentos();
    for (const doc of hoja.documentos || []) {
      if (doc.pedidoIdEnc) ocupacion.pedidosEnHojas.set(pedidoClave(doc.pedidoIdEnc), {
        ambito: "hoja",
        id: String(hoja._id),
        etiqueta: `la hoja de ruta ${hoja.idHoja}`,
      });
    }

    const cargues = await carguesModel
      .find({ estado: "enviado" }, { idCargue: 1, documentos: 1, despachadorNombre: 1, bodega: 1 })
      .lean();

    const body = [];
    for (const cargue of cargues) {
      for (const doc of cargue.documentos || []) {
        const idEnc = pedidoClave(doc.idEnc);
        if (!idEnc || ocupacion.pedidosEnHojas.has(idEnc)) continue;
        const nro = claveFactura(doc.nroFactura || doc.nroDoc);
        if (nro && nro !== claveFactura(idEnc) && ocupacion.facturas.has(nro)) continue;
        body.push({
          pedidoIdEnc: idEnc,
          tipoDoc: doc.tipoDoc || doc.tipo || "PEDIDO",
          tipoDocto: doc.tipoDocto || "",
          nroDoc: doc.nroDoc || "",
          cliente: doc.cliente || "",
          nit: doc.nit || "",
          sucursal: doc.sucursal || "",
          barrio: doc.barrio || "",
          municipio: doc.municipio || "",
          peso: Number(doc.peso) || 0,
          valor: Number(doc.valor) || 0,
          bodega: doc.bodega || cargue.bodega || "",
          idCargue: cargue.idCargue,
          cargueId: String(cargue._id),
          fecha: doc.fecha || "",
        });
      }
    }
    body.sort((a, b) => String(b.pedidoIdEnc).localeCompare(String(a.pedidoIdEnc)));
    return ok(res, body);
  } catch (error) {
    console.error("getDocumentosDisponibles hoja:", error.message);
    return fail(res, "No se pudieron leer los pedidos despachados.", 500);
  }
};

hojaCtr.agregarDocumentos = async (req, res) => {
  try {
    const { _id, items } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Hoja inválida.");
    const hoja = await hojaModel.findById(_id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "anulada") return fail(res, "Esta hoja está anulada.", 400);
    if (hoja.estado === "vigente") {
      return fail(res, "Confirme la hoja en temporal para editar documentos, o anúlela.", 400);
    }

    const lista = Array.isArray(items) ? items : [];
    if (!lista.length) return fail(res, "Seleccione al menos un pedido despachado.");

    const ocupacion = await ocupacionDocumentos();
    const cargues = await carguesModel.find({ estado: "enviado" }).lean();
    const porPedido = new Map();
    for (const cargue of cargues) {
      for (const doc of cargue.documentos || []) {
        porPedido.set(pedidoClave(doc.idEnc), { doc, cargue });
      }
    }

    const nuevos = [];
    const bloqueadas = [];
    for (const item of lista) {
      const idEnc = pedidoClave(item.pedidoIdEnc || item.idEnc);
      const nroFactura = claveFactura(item.nroFactura || item.nroDoc);
      if (!idEnc || !nroFactura) continue;
      const porPedidoHoja = bloqueoPedidoEnHoja(ocupacion, idEnc);
      const porFactura = bloqueoFacturaEnHoja(ocupacion, nroFactura);
      if (porPedidoHoja) {
        bloqueadas.push(textoOcupado(idEnc, porPedidoHoja));
        continue;
      }
      if (porFactura) {
        bloqueadas.push(textoOcupado(nroFactura, porFactura));
        continue;
      }
      const hallado = porPedido.get(idEnc);
      if (!hallado) continue;
      const { doc, cargue } = hallado;
      nuevos.push(
        lineaDesdeDespacho(doc, cargue, {
          nroFactura,
          tipoDoc: item.tipoDoc || doc.tipoDoc || "FACTURA",
          tipoDocto: item.tipoDocto || doc.tipoDocto || "",
        })
      );
      ocupacion.pedidosEnHojas.set(idEnc, {
        ambito: "hoja",
        id: String(hoja._id),
        etiqueta: `la hoja de ruta ${hoja.idHoja}`,
      });
      ocupacion.facturas.set(nroFactura, {
        ambito: "hoja",
        id: String(hoja._id),
        etiqueta: `la hoja de ruta ${hoja.idHoja}`,
      });
    }

    if (bloqueadas.length && !nuevos.length) {
      return fail(
        res,
        `Una factura no puede repetirse en hojas de ruta ni cargues. ${bloqueadas.join(". ")}.`,
        400
      );
    }
    if (!nuevos.length) {
      return fail(
        res,
        "Ningún ítem cumple: pedido despachado, con factura y sin otra hoja de ruta ni cargue.",
        400
      );
    }

    hoja.documentos.push(...nuevos);
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, {
      ...resumen(hoja.toObject()),
      aviso: bloqueadas.length ? `No se agregaron: ${bloqueadas.join(". ")}.` : "",
    });
  } catch (error) {
    console.error("agregarDocumentos hoja:", error.message);
    return fail(res, "No se pudieron agregar los documentos.", 500);
  }
};

hojaCtr.getFacturas = async (req, res) => {
  try {
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    const nit = String(req.query.nit || "").trim();
    const razonSocial = String(req.query.razon_social || req.query.razonSocial || "").trim();
    const contacto = String(req.query.contacto || "").trim();
    const barrio = String(req.query.barrio || "").trim();
    const municipio = String(req.query.municipio || "").trim();
    const numFactura = String(req.query.num_factura || req.query.numFactura || "").trim();
    const tipoDoc = String(req.query.tipo_doc || req.query.tipoDoc || "").trim();
    const bodega = String(req.query.bodega || "").trim();
    const vendedor = String(req.query.vendedor || "").trim();

    let origen = "cache";
    let descarga = { facturas: [], consulta: siesaFacturas.configFacturas().consulta, aviso: "" };
    const refrescar = String(req.query.refrescar || "") === "1";
    const filtroCache = {};
    if (desde || hasta) {
      filtroCache.fecha = {};
      if (desde) filtroCache.fecha.$gte = desde;
      if (hasta) filtroCache.fecha.$lte = hasta;
    }
    let cache = await facturasModel.find(filtroCache).sort({ fecha: -1, numFactura: -1 }).limit(800).lean();
    if (!cache.length) {
      cache = await facturasModel.find().sort({ fecha: -1, numFactura: -1 }).limit(800).lean();
    }

    if (cache.length && !refrescar) {
      descarga = { ...descarga, facturas: cache };
    } else if (refrescar) {
      try {
        origen = "siesa";
        descarga = await siesaFacturas.descargarFacturasSiesa({
          desde: desde || "",
          hasta: hasta || "",
        });
        await persistirFacturas(descarga.facturas);
      } catch (error) {
        origen = "cache";
        if (!cache.length) {
          return fail(
            res,
            error.message ||
              "No se pudieron leer las facturas. Revise carnicosyalimentos_Prevalentware_facturas en Connekta v3.",
            error.status || 502
          );
        }
        descarga = { ...descarga, facturas: cache, aviso: error.message };
      }
    } else {
      descarga = { ...descarga, facturas: cache };
    }

    let facturas = await enriquecerConPedidos(descarga.facturas || []);
    const ocupados = await ocupacionDocumentos();
    const tipos = [...new Set(facturas.map((item) => item.tipoDoc || item.tipoDocPedido).filter(Boolean))].sort();
    const bodegas = [...new Set(facturas.map((item) => item.bodega).filter(Boolean))].sort();
    const vendedores = [...new Set(facturas.map((item) => item.vendedor).filter(Boolean))].sort();

    facturas = facturas.filter((item) => {
      const nro = claveFactura(item.numFactura);
      const pedido = pedidoClave(item.numPedido || item.nroDoc || item.id430);
      if (nro && ocupados.facturas.has(nro)) return false;
      if (pedido && ocupados.pedidosEnHojas.has(pedido)) return false;
      if (!cumpleFiltroTexto(item.nit, nit)) return false;
      if (!cumpleFiltroTexto(item.razonSocial, razonSocial)) return false;
      if (!cumpleFiltroTexto(item.contacto, contacto)) return false;
      if (!cumpleFiltroTexto(item.barrio, barrio)) return false;
      if (!cumpleFiltroTexto(item.municipio, municipio)) return false;
      if (!cumpleFiltroTexto(item.numFactura, numFactura)) return false;
      if (tipoDoc && String(item.tipoDoc || item.tipoDocPedido || "") !== tipoDoc) return false;
      if (bodega && String(item.bodega || "") !== bodega) return false;
      if (vendedor && String(item.vendedor || "") !== vendedor) return false;
      return true;
    });

    const conFecha = facturas.filter((item) => {
      if (desde && String(item.fecha || "") < desde) return false;
      if (hasta && String(item.fecha || "") > hasta) return false;
      return true;
    });
    if (conFecha.length) {
      facturas = conFecha;
    } else if (facturas.length && (desde || hasta)) {
      descarga.aviso = [descarga.aviso, `No hay facturas entre ${desde || "…"} y ${hasta || "…"}. Se listan las más recientes.`]
        .filter(Boolean)
        .join(" ");
    }

    return ok(res, {
      facturas,
      origen,
      consulta: descarga.consulta,
      aviso: descarga.aviso || "",
      tipos,
      bodegas,
      vendedores,
    });
  } catch (error) {
    console.error("getFacturas:", error.message);
    return fail(res, error.message || "No se pudieron leer las facturas.", error.status || 500);
  }
};

hojaCtr.agregarFacturasSiesa = async (req, res) => {
  try {
    const { _id, items } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Hoja inválida.");
    const hoja = await hojaModel.findById(_id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "temporal") return fail(res, "Solo se editan hojas temporales.", 400);

    const lista = Array.isArray(items) ? items : [];
    const claves = lista
      .map((item) => String(item.numFactura || item.nroFactura || item.factura || "").trim())
      .filter(Boolean);
    if (!claves.length) return fail(res, "Seleccione al menos una factura.");

    const ocupacion = await ocupacionDocumentos();
    const locales = await facturasModel.find({ numFactura: { $in: claves } }).lean();
    const porNumero = new Map(locales.map((item) => [claveFactura(item.numFactura), item]));
    for (const item of lista) {
      const nro = claveFactura(item.numFactura || item.nroFactura || "");
      if (nro && !porNumero.has(nro)) porNumero.set(nro, item);
    }

    const nuevos = [];
    const bloqueadas = [];
    for (const raw of claves) {
      const nro = claveFactura(raw);
      const factura = porNumero.get(nro);
      if (!factura) continue;
      const pedido = pedidoClave(factura.numPedido || factura.nroDoc || factura.id430);
      const porFactura = bloqueoFacturaEnHoja(ocupacion, nro);
      const porPedido = bloqueoPedidoEnHoja(ocupacion, pedido);
      if (porFactura) {
        bloqueadas.push(textoOcupado(nro, porFactura));
        continue;
      }
      if (porPedido) {
        bloqueadas.push(textoOcupado(pedido || nro, porPedido));
        continue;
      }
      nuevos.push(lineaDesdeFactura(factura));
      ocupacion.facturas.set(nro, { ambito: "hoja", id: String(hoja._id), etiqueta: `la hoja de ruta ${hoja.idHoja}` });
      if (pedido) {
        ocupacion.pedidosEnHojas.set(pedido, {
          ambito: "hoja",
          id: String(hoja._id),
          etiqueta: `la hoja de ruta ${hoja.idHoja}`,
        });
      }
    }

    if (bloqueadas.length && !nuevos.length) {
      return fail(
        res,
        `Una factura no puede repetirse en hojas de ruta ni cargues. ${bloqueadas.join(". ")}.`,
        400
      );
    }
    if (!nuevos.length) {
      return fail(res, "Ninguna factura está libre para agregar a esta hoja.", 400);
    }
    hoja.documentos.push(...nuevos);
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, {
      ...resumen(hoja.toObject()),
      aviso: bloqueadas.length ? `No se agregaron: ${bloqueadas.join(". ")}.` : "",
    });
  } catch (error) {
    console.error("agregarFacturasSiesa:", error.message);
    return fail(res, "No se pudieron agregar las facturas.", 500);
  }
};

hojaCtr.agregarPorFactura = async (req, res) => {
  try {
    const { _id } = req.body || {};
    const factura = String(req.body?.factura || "").trim();
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Hoja inválida.");
    if (!factura) return fail(res, "Indique el número de factura.");
    const hoja = await hojaModel.findById(_id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "temporal") return fail(res, "Solo se editan hojas temporales.", 400);

    const ocupacion = await ocupacionDocumentos();
    const nro = claveFactura(factura);
    const porFactura = bloqueoFacturaEnHoja(ocupacion, nro);
    if (porFactura) {
      return fail(res, `Esa factura no puede repetirse: ${textoOcupado(nro, porFactura)}.`, 400);
    }

    const locales = await facturasModel
      .find({
        $or: [{ numFactura: factura }, { nroDoc: factura }, { numPedido: factura }, { id461: factura }],
      })
      .lean();
    const local = locales.find((item) => claveFactura(item.numFactura) === nro) || locales[0];
    if (local) {
      const pedido = pedidoClave(local.numPedido || local.nroDoc || local.id430);
      const porPedido = bloqueoPedidoEnHoja(ocupacion, pedido);
      if (porPedido) {
        return fail(res, `Ese pedido ya está asignado: ${textoOcupado(pedido, porPedido)}.`, 400);
      }
      hoja.documentos.push(lineaDesdeFactura(local));
      hoja.fecha_actualizacion = new Date();
      await hoja.save();
      return ok(res, resumen(hoja.toObject()));
    }

    const cargues = await carguesModel.find({ estado: "enviado" }).lean();
    let hallado = null;
    for (const cargue of cargues) {
      for (const doc of cargue.documentos || []) {
        const idEnc = pedidoClave(doc.idEnc);
        const nroDoc = claveFactura(doc.nroDoc);
        if (!idEnc) continue;
        if (bloqueoPedidoEnHoja(ocupacion, idEnc)) continue;
        if (idEnc.toUpperCase() === nro || nroDoc === nro) {
          hallado = { doc, cargue };
          break;
        }
      }
      if (hallado) break;
    }
    if (!hallado) {
      return fail(
        res,
        "No hay una factura SIESA ni un pedido despachado con ese número. Use Agregar_facturas.",
        404
      );
    }
    hoja.documentos.push(
      lineaDesdeDespacho(hallado.doc, hallado.cargue, { nroFactura: factura, tipoDoc: "FACTURA" })
    );
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, resumen(hoja.toObject()));
  } catch (error) {
    console.error("agregarPorFactura:", error.message);
    return fail(res, "No se pudo agregar la factura.", 500);
  }
};

hojaCtr.actualizarHoja = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Hoja inválida.");
    const hoja = await hojaModel.findById(_id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "anulada") return fail(res, "Esta hoja está anulada.", 400);

    const nombre = req.body.nombre != null ? String(req.body.nombre).trim() : hoja.nombre;
    const fecha = req.body.fecha != null ? String(req.body.fecha).slice(0, 10) : hoja.fecha;
    const temperatura = req.body.temperatura != null ? String(req.body.temperatura).trim() : hoja.temperatura;
    const pesoAdicional = req.body.pesoAdicional != null ? Number(req.body.pesoAdicional) : hoja.pesoAdicional;
    if (!nombre) return fail(res, "El nombre de la ruta es obligatorio.");

    hoja.nombre = nombre;
    hoja.fecha = fecha || hoja.fecha;
    hoja.temperatura = temperatura;
    hoja.pesoAdicional = Number.isFinite(pesoAdicional) ? pesoAdicional : hoja.pesoAdicional;
    if (req.body.canastas != null) hoja.canastas = String(req.body.canastas).trim();
    if (req.body.bultos != null) hoja.bultos = String(req.body.bultos).trim();
    if (req.body.auxiliar != null) hoja.auxiliar = String(req.body.auxiliar).trim();
    if (req.body.telDistribucion != null) hoja.telDistribucion = String(req.body.telDistribucion).trim();
    if (req.body.canastasIfco != null) hoja.canastasIfco = String(req.body.canastasIfco).trim();
    if (req.body.observaciones != null) hoja.observaciones = String(req.body.observaciones).trim();
    try {
      await aplicarFirmantes(hoja, req.body || {});
    } catch (error) {
      return fail(res, error.message, error.status || 400);
    }

    if (req.body.placa) {
      const placa = String(req.body.placa).trim().toUpperCase();
      const vehiculo = await vehiculoModel.findOne({ placa, estado: 0 }).lean();
      if (!vehiculo) return fail(res, "El vehículo no existe.");
      Object.assign(hoja, snapshotVehiculo(vehiculo));
    }

    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, resumen(hoja.toObject()));
  } catch (error) {
    console.error("actualizarHoja:", error.message);
    return fail(res, "No se pudo guardar la hoja de ruta.", 500);
  }
};

hojaCtr.eliminarDocumentos = async (req, res) => {
  try {
    const { _id, ids } = req.body || {};
    const hoja = await hojaModel.findById(_id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "temporal") {
      return fail(res, "Solo se pueden quitar documentos en una hoja temporal.", 400);
    }
    const quitar = new Set((Array.isArray(ids) ? ids : []).map(String));
    hoja.documentos = (hoja.documentos || []).filter(
      (doc) => !quitar.has(String(doc._id)) && !quitar.has(String(doc.pedidoIdEnc))
    );
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, resumen(hoja.toObject()));
  } catch (error) {
    console.error("eliminarDocumentos hoja:", error.message);
    return fail(res, "No se pudieron quitar los documentos.", 500);
  }
};

hojaCtr.confirmarHoja = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params._id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado !== "temporal") return fail(res, "Solo se confirman hojas temporales.", 400);
    if (!(hoja.documentos || []).length) {
      return fail(res, "Agregue al menos un pedido con factura antes de confirmar.", 400);
    }
    const ocupacion = await ocupacionDocumentos();
    const vistasF = new Set();
    const vistasP = new Set();
    for (const doc of hoja.documentos || []) {
      const nro = claveFactura(doc.nroFactura);
      const pedido = pedidoClave(doc.pedidoIdEnc);
      if (nro) {
        if (vistasF.has(nro)) {
          return fail(res, `La factura ${nro} está repetida en esta hoja.`, 400);
        }
        const info = ocupacion.facturas.get(nro);
        if (info && !(info.ambito === "hoja" && info.id === String(hoja._id))) {
          return fail(res, `Una factura no puede repetirse en hojas de ruta ni cargues. ${textoOcupado(nro, info)}.`, 400);
        }
        vistasF.add(nro);
      }
      if (pedido) {
        if (vistasP.has(pedido)) {
          return fail(res, `El pedido ${pedido} está repetido en esta hoja.`, 400);
        }
        const info = ocupacion.pedidosEnHojas.get(pedido);
        if (info && info.id !== String(hoja._id)) {
          return fail(res, `El pedido ${pedido} ya está en ${info.etiqueta}.`, 400);
        }
        vistasP.add(pedido);
      }
    }
    hoja.estado = "vigente";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, resumen(hoja.toObject()));
  } catch (error) {
    console.error("confirmarHoja:", error.message);
    return fail(res, "No se pudo confirmar la hoja de ruta.", 500);
  }
};

hojaCtr.anularHoja = async (req, res) => {
  try {
    const hoja = await hojaModel.findById(req.params._id);
    if (!hoja) return fail(res, "No se encontró la hoja de ruta.", 404);
    if (hoja.estado === "anulada") return fail(res, "Esta hoja ya está anulada.", 400);
    hoja.estado = "anulada";
    hoja.fecha_actualizacion = new Date();
    await hoja.save();
    return ok(res, resumen(hoja.toObject()));
  } catch (error) {
    console.error("anularHoja:", error.message);
    return fail(res, "No se pudo anular la hoja de ruta.", 500);
  }
};

export default hojaCtr;
