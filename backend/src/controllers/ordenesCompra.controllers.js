import ordenesModel from "../models/ordenesCompra.models";
import carguesModel from "../models/cargues.models";
import bodegaModel from "../models/bodega.models";
import itemsModel from "../models/items.models";
import { parsearHseOrdenes } from "../services/hseOrdenes.servicios";
import { resolverItemPorEan, resolverTiendaPorGln } from "./codigosEan.controllers";

const ocCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const usuarioDe = (req) => {
  const identity = req.user?.identity || {};
  return String(identity.nombre || identity.usuario || "Administrador").trim();
};

const idEncDe = (nroPedido) => `OC-${String(nroPedido || "").trim()}`;

const siguienteId = async () => {
  const ultimo = await ordenesModel.findOne().sort({ idOc: -1 }).lean();
  return (ultimo?.idOc || 0) + 1;
};

const totalesDe = (lineas = []) => {
  const peso = lineas.reduce((acc, linea) => acc + (Number(linea.kilos) || 0), 0);
  const unidades = lineas.reduce((acc, linea) => acc + (Number(linea.unidades) || 0), 0);
  const valor = lineas.reduce(
    (acc, linea) => acc + (Number(linea.cantidad) || 0) * (Number(linea.precio) || 0),
    0
  );
  return {
    peso: Number(peso.toFixed(2)),
    unidades: Number(unidades.toFixed(2)),
    valor: Number(valor.toFixed(2)),
  };
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

/** Etiqueta de unidad EDIFACT / HSE (como pidió la cadena). */
export const etiquetaUnidadPedido = (codigo) => {
  const u = String(codigo || "").trim().toUpperCase();
  if (!u) return "";
  if (u === "NAR" || u === "PCE" || u === "EA") return "UND";
  if (u === "KGM" || u === "KG" || u === "KGS") return "KG";
  if (u === "GRM" || u === "GR") return "GR";
  if (u === "LTR" || u === "LT") return "LT";
  if (u === "HR") return "EMPAQUE";
  return u;
};

const hallarItem = async ({ ean, codigoComprador, gln = "" }) => {
  const porEan = await resolverItemPorEan(ean, gln);
  if (porEan) {
    return {
      item: porEan.item || null,
      referenciaMapa: porEan.referencia,
      descripcionMapa: porEan.descripcionMapa || "",
    };
  }

  const claves = [...new Set([ean, codigoComprador].map((v) => String(v || "").trim()).filter(Boolean))];
  if (!claves.length) return { item: null, referenciaMapa: "", descripcionMapa: "" };
  const or = [];
  for (const clave of claves) {
    or.push({ ean: clave });
    or.push({ referencia: clave });
    or.push({ codigoItem: clave });
    or.push({ item: clave });
  }
  const item = await itemsModel.findOne({ $or: or }).lean();
  return { item: item || null, referenciaMapa: "", descripcionMapa: "" };
};

const enriquecerLineas = async (lineasHse = [], { glnEntrega = "" } = {}) => {
  const avisos = [];
  const lineas = [];
  const cacheGln = new Map();

  const tiendaDe = async (gln) => {
    const clave = String(gln || "").trim();
    if (!clave) return {};
    if (cacheGln.has(clave)) return cacheGln.get(clave);
    const tienda = (await resolverTiendaPorGln(clave)) || {};
    cacheGln.set(clave, tienda);
    return tienda;
  };

  for (const raw of lineasHse) {
    const ean = String(raw.ean || "").trim();
    const codigoComprador = String(raw.codigoComprador || "").trim();
    const cantidad = Number(raw.cantidad) || 0;
    const unidadPedido = String(raw.unidad || "NAR").trim().toUpperCase() || "NAR";
    const hallado = await hallarItem({ ean, codigoComprador, gln: glnEntrega });
    const item = hallado.item;
    const matched = Boolean(item);
    if (!matched && !hallado.referenciaMapa) {
      avisos.push(
        `Sin cruce EAN/ítem: EAN ${ean || "—"} / código cadena ${codigoComprador || "—"}`
      );
    } else if (!matched && hallado.referenciaMapa) {
      avisos.push(
        `EAN ${ean} → ref ${hallado.referenciaMapa}, pero no hay ítem en catálogo CEM`
      );
    }
    const undInv = item?.undInventario || "";
    const undPedidoEtiqueta = etiquetaUnidadPedido(unidadPedido);
    const esPedidoKg = undPedidoEtiqueta === "KG";

    const hijos = [];
    for (const h of raw.hijos || []) {
      const gln = String(h.gln || "").trim();
      if (!gln) continue;
      const tienda = await tiendaDe(gln);
      hijos.push({
        gln,
        cantidad: Number(h.cantidad) || 0,
        unidad: String(h.unidad || unidadPedido).toUpperCase(),
        nombreEstablecimiento: tienda.nombreEstablecimiento || "",
        codigoEstablecimiento: tienda.codigoEstablecimiento || "",
        razonSocial: tienda.razonSocial || "",
      });
    }

    lineas.push({
      nroLinea: String(raw.nroLinea || ""),
      ean,
      codigoComprador,
      item: item?.item || "",
      codigoItem: item?.codigoItem || "",
      referencia: item?.referencia || hallado.referenciaMapa || codigoComprador || ean,
      descripcion:
        item?.descripcion ||
        hallado.descripcionMapa ||
        String(raw.descripcion || "").trim() ||
        "",
      undInventario: undInv,
      cantidad,
      unidadPedido,
      unidadPedidoEtiqueta: undPedidoEtiqueta,
      precio: Number(raw.precio) || 0,
      empaque: Number(raw.empaque) || 0,
      kilos: esPedidoKg ? cantidad : 0,
      unidades: esPedidoKg ? 0 : cantidad,
      matched,
      hijos,
    });
  }
  return { lineas, avisos, cacheGln };
};

const puntosVentaDe = async (glnsHijos = [], cacheGln = null) => {
  const puntos = [];
  const vistos = new Set();
  for (const glnRaw of glnsHijos || []) {
    const gln = String(glnRaw || "").trim();
    if (!gln || vistos.has(gln)) continue;
    vistos.add(gln);
    let tienda = cacheGln?.get?.(gln);
    if (!tienda) tienda = (await resolverTiendaPorGln(gln)) || {};
    puntos.push({
      gln,
      nombreEstablecimiento: tienda.nombreEstablecimiento || "",
      codigoEstablecimiento: tienda.codigoEstablecimiento || "",
      razonSocial: tienda.razonSocial || "",
    });
  }
  return puntos;
};

export const snapshotOc = (doc) => {
  const lineas = (doc.lineas || []).map((linea) => lineaOcASnap(linea));
  return armarSnapOc(doc, {
    idEnc: String(doc.idEnc || ""),
    glnEntrega: doc.glnEntrega || doc.glnComprador || "",
    nombreEstablecimiento: doc.nombreEstablecimiento || "",
    codigoEstablecimiento: doc.codigoEstablecimiento || doc.codigoDep || "",
    razonSocial: doc.razonSocial || "",
    codigoDep: doc.codigoDep || doc.codigoEstablecimiento || "",
    dependencia: doc.dependencia || doc.nombreEstablecimiento || "",
    zona: doc.zona || "",
    cadena: doc.cadena || doc.razonSocial || "",
    lineas,
  });
};

const lineaOcASnap = (linea, override = null) => {
  const undPed =
    override?.unidadPedidoEtiqueta ||
    linea.unidadPedidoEtiqueta ||
    etiquetaUnidadPedido(override?.unidad || linea.unidadPedido) ||
    "UND";
  const ean = String(linea.ean || "").trim();
  const cantidad =
    override?.cantidad != null ? Number(override.cantidad) || 0 : Number(linea.cantidad) || 0;
  const esKg =
    String(undPed).toUpperCase() === "KG" ||
    String(undPed).toUpperCase() === "KGM" ||
    /^2\d{12}$/.test(ean);
  return {
    item: linea.item || "",
    codigoItem: linea.codigoItem || "",
    referencia: linea.referencia || linea.codigoComprador || linea.ean || "",
    descripcion: linea.descripcion || "",
    undInventario: linea.undInventario || "",
    unidadPedido: esKg ? "KGM" : override?.unidad || linea.unidadPedido || "",
    unidadPedidoEtiqueta: esKg ? "KG" : undPed,
    cantidad,
    cant1: esKg ? 0 : cantidad || Number(linea.unidades) || 0,
    cant2: esKg ? cantidad : Number(linea.kilos) || 0,
    kilo: esKg ? cantidad : Number(linea.kilos) || 0,
    unidades: esKg ? 0 : cantidad || Number(linea.unidades) || 0,
    kilos: esKg ? cantidad : Number(linea.kilos) || 0,
    ean,
    codigoComprador: linea.codigoComprador || "",
    precio: Number(linea.precio) || 0,
  };
};

const armarSnapOc = (doc, opts) => {
  const lineas = opts.lineas || [];
  const entrega = opts.glnEntrega || "";
  const tienda = opts.nombreEstablecimiento || "";
  const cod = opts.codigoEstablecimiento || opts.codigoDep || "";
  const etiquetaTienda = cod && tienda ? `${cod}-${tienda}` : tienda || cod || entrega;
  const totalUnd = lineas.reduce((acc, l) => acc + (Number(l.unidades) || 0), 0);
  const totalKg = lineas.reduce((acc, l) => acc + (Number(l.kilos) || 0), 0);
  const totalCant = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
  const valorLineas = lineas.reduce(
    (acc, l) => acc + (Number(l.precio) || 0) * (Number(l.cantidad) || 0),
    0
  );
  const productosResumen = lineas
    .slice(0, 4)
    .map((l) => {
      const ref = l.referencia || l.ean || "";
      const desc = l.descripcion || "";
      const und = l.unidadPedidoEtiqueta || "UND";
      return `${ref}${desc ? ` ${desc}` : ""} (${l.cantidad} ${und})`.trim();
    })
    .join(" · ");
  const mas = lineas.length > 4 ? ` · +${lineas.length - 4} más` : "";
  const cedi = String(doc.nombreEstablecimiento || doc.codigoEstablecimiento || "").trim();
  const obsBase = String(doc.observacion || "").trim();
  const obsCedi =
    opts.esPdv && cedi ? `CEDI ${cedi}${obsBase ? ` · ${obsBase}` : ""}` : obsBase;
  return {
    tipo: "OC",
    tipoDoc: "ORDEN DE COMPRA",
    idEnc: String(opts.idEnc || ""),
    idEncMadre: String(opts.idEncMadre || doc.idEnc || ""),
    nroDoc: String(doc.nroPedido || doc.idEnc || ""),
    tipoDocto: "OC",
    nit: entrega,
    codigoCliente: cod || entrega,
    codigo: doc.glnComprador || "",
    observacion: obsCedi,
    fecha: doc.fecha || "",
    fechaEntregaDesde: doc.fechaEntregaDesde || "",
    fechaEntregaHasta: doc.fechaEntregaHasta || "",
    sucursal: etiquetaTienda || entrega,
    municipio: "",
    barrio: "",
    cndPago: doc.pagoDias != null ? String(doc.pagoDias) : "",
    direccion: "",
    vendedor: "",
    contacto: "",
    telefono: "",
    valor: valorLineas || Number(doc.valor) || 0,
    peso: totalKg,
    unidades: totalUnd || totalCant,
    cantidad: totalCant,
    unidadesPedido: [...new Set(lineas.map((l) => l.unidadPedidoEtiqueta).filter(Boolean))].join(
      ", "
    ),
    productosResumen: (productosResumen + mas).trim(),
    totalLineas: lineas.length,
    glnEntrega: entrega,
    razonSocial: opts.razonSocial || doc.razonSocial || "",
    nombreEstablecimiento: etiquetaTienda,
    codigoEstablecimiento: cod,
    cliente: etiquetaTienda || `OC ${doc.nroPedido || ""}`.trim(),
    establecimiento: etiquetaTienda || entrega,
    codigoDep: opts.codigoDep || cod,
    dependencia: opts.dependencia || tienda || "",
    zona: opts.zona || doc.zona || "",
    gln: entrega,
    cadena: opts.cadena || doc.cadena || doc.razonSocial || "",
    hora: "",
    bodega: doc.bodegaOrigen || "",
    estado: doc.estado || "",
    lineas,
  };
};

/** idEnc de OC en cargue: `OC-0020…` o `OC-0020…#GLN` (PDV hijo). */
export const idEncOcMadreDe = (idEnc) => {
  const s = String(idEnc || "").trim();
  const i = s.indexOf("#");
  return i > 0 ? s.slice(0, i) : s;
};

export const glnOcPdvDe = (idEnc) => {
  const s = String(idEnc || "").trim();
  const i = s.indexOf("#");
  return i > 0 ? s.slice(i + 1).trim() : "";
};

/**
 * Una fila pesable por PDV cuando la OC es madre+hijos.
 * OC simple → un solo snapshot (comportamiento anterior).
 */
export const snapshotsOcDespacho = (doc) => {
  const tieneHijos =
    Boolean(doc?.tieneHijos) ||
    doc?.estructura === "madre-hijos" ||
    (doc?.lineas || []).some((l) => Array.isArray(l?.hijos) && l.hijos.length);
  if (!tieneHijos) return [snapshotOc(doc)];

  const madreId = String(doc.idEnc || "").trim() || `OC-${String(doc.nroPedido || "").trim()}`;
  const porGln = new Map();
  for (const lin of doc.lineas || []) {
    for (const h of lin.hijos || []) {
      const gln = String(h?.gln || "").trim();
      if (!gln) continue;
      if (!porGln.has(gln)) {
        porGln.set(gln, {
          gln,
          codigoEstablecimiento: String(h.codigoEstablecimiento || "").trim(),
          nombreEstablecimiento: String(h.nombreEstablecimiento || "").trim(),
          razonSocial: String(h.razonSocial || doc.razonSocial || "").trim(),
          lineas: [],
        });
      }
      const pdv = porGln.get(gln);
      if (!pdv.codigoEstablecimiento && h.codigoEstablecimiento) {
        pdv.codigoEstablecimiento = String(h.codigoEstablecimiento).trim();
      }
      if (!pdv.nombreEstablecimiento && h.nombreEstablecimiento) {
        pdv.nombreEstablecimiento = String(h.nombreEstablecimiento).trim();
      }
      pdv.lineas.push(
        lineaOcASnap(lin, {
          cantidad: Number(h.cantidad) || 0,
          unidad: h.unidad || lin.unidadPedido,
        })
      );
    }
  }
  if (!porGln.size) return [snapshotOc(doc)];

  return [...porGln.values()].map((pdv) =>
    armarSnapOc(doc, {
      idEnc: `${madreId}#${pdv.gln}`,
      idEncMadre: madreId,
      esPdv: true,
      glnEntrega: pdv.gln,
      nombreEstablecimiento: pdv.nombreEstablecimiento,
      codigoEstablecimiento: pdv.codigoEstablecimiento,
      codigoDep: pdv.codigoEstablecimiento,
      dependencia: pdv.nombreEstablecimiento,
      razonSocial: pdv.razonSocial || doc.razonSocial || "",
      cadena: pdv.razonSocial || doc.cadena || doc.razonSocial || "",
      zona: doc.zona || "",
      lineas: pdv.lineas,
    })
  );
};

const resumen = (doc) => {
  const t = totalesDe(doc.lineas);
  const unds = [...new Set((doc.lineas || []).map((l) => l.unidadPedidoEtiqueta || etiquetaUnidadPedido(l.unidadPedido)).filter(Boolean))];
  const totalPdv = Array.isArray(doc.puntosVenta) ? doc.puntosVenta.length : 0;
  return {
    ...doc,
    peso: doc.peso ?? t.peso,
    unidades: doc.unidades ?? t.unidades,
    valor: doc.valor ?? t.valor,
    totalLineas: (doc.lineas || []).length,
    lineasSinMatch: (doc.lineas || []).filter((l) => !l.matched).length,
    unidadesPedido: unds.join(", "),
    totalPuntosVenta: totalPdv,
    estructura: doc.estructura || (doc.tieneHijos || totalPdv ? "madre-hijos" : "simple"),
  };
};

ocCtr.listar = async (req, res) => {
  try {
    const estado = String(req.query.estado || "").trim().toLowerCase();
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    const id = String(req.query.id || "").trim();
    const numOrden = String(req.query.numOrden || req.query.nroPedido || "").trim();
    const bodega = String(req.query.bodega || req.query.bodegaOrigen || "").trim();
    const cliente = String(req.query.cliente || "").trim();
    const localizacion = String(req.query.localizacion || "").trim();
    const q = String(req.query.q || "").trim();

    const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filtro = {};
    const and = [];

    if (estado) filtro.estado = estado;
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = hasta;
    }
    if (bodega) filtro.bodegaOrigen = new RegExp(`^${escRx(bodega)}$`, "i");
    if (id) {
      const rx = new RegExp(escRx(id), "i");
      const orId = [{ idEnc: rx }, { nroPedido: rx }];
      if (/^\d+$/.test(id)) orId.push({ idOc: Number(id) });
      and.push({ $or: orId });
    }
    if (numOrden) {
      and.push({
        $or: [
          { nroPedido: new RegExp(escRx(numOrden), "i") },
          { idEnc: new RegExp(escRx(numOrden), "i") },
        ],
      });
    }
    if (cliente) {
      const rx = new RegExp(escRx(cliente), "i");
      and.push({
        $or: [
          { razonSocial: rx },
          { nombreEstablecimiento: rx },
          { cadena: rx },
          { dependencia: rx },
          { "puntosVenta.razonSocial": rx },
          { "puntosVenta.nombreEstablecimiento": rx },
        ],
      });
    }
    if (localizacion) {
      const rx = new RegExp(escRx(localizacion), "i");
      and.push({
        $or: [
          { glnEntrega: rx },
          { glnCedi: rx },
          { codigoEstablecimiento: rx },
          { codigoDep: rx },
          { nombreEstablecimiento: rx },
          { "puntosVenta.gln": rx },
          { "puntosVenta.codigoEstablecimiento": rx },
          { "puntosVenta.nombreEstablecimiento": rx },
        ],
      });
    }
    if (q) {
      const rx = new RegExp(escRx(q), "i");
      and.push({
        $or: [
          { nroPedido: rx },
          { idEnc: rx },
          { glnEntrega: rx },
          { nombreEstablecimiento: rx },
          { razonSocial: rx },
          { archivoNombre: rx },
        ],
      });
    }
    if (and.length) filtro.$and = and;

    const lista = await ordenesModel.find(filtro).sort({ idOc: -1 }).lean();
    const body = [];
    for (const doc of lista) {
      if (!doc.nombreEstablecimiento && doc.glnEntrega) {
        const tienda = await resolverTiendaPorGln(doc.glnEntrega);
        if (tienda?.nombreEstablecimiento) {
          await ordenesModel.updateOne(
            { _id: doc._id },
            {
              $set: {
                nombreEstablecimiento: tienda.nombreEstablecimiento,
                codigoEstablecimiento: tienda.codigoEstablecimiento || "",
                razonSocial: tienda.razonSocial || "",
              },
            }
          );
          doc.nombreEstablecimiento = tienda.nombreEstablecimiento;
          doc.codigoEstablecimiento = tienda.codigoEstablecimiento || "";
          doc.razonSocial = tienda.razonSocial || "";
        }
      }
      body.push(resumen(doc));
    }
    return ok(res, body);
  } catch (error) {
    console.error("oc.listar:", error.message);
    return fail(res, "No se pudieron leer las órdenes de compra.", 500);
  }
};

ocCtr.getUno = async (req, res) => {
  try {
    const body = await ordenesModel.findById(req.params._id).lean();
    if (!body) return fail(res, "No se encontró la orden de compra.", 404);
    return ok(res, resumen(body));
  } catch (error) {
    return fail(res, "No se pudo leer la orden de compra.", 500);
  }
};

ocCtr.importarHse = async (req, res) => {
  try {
    const archivo = req.file;
    if (!archivo?.buffer) return fail(res, "Adjunte un archivo .hse.", 400);
    const bodegaOrigen = String(req.body?.bodegaOrigen || "").trim();
    if (!bodegaOrigen) return fail(res, "Seleccione la bodega de origen (despacho).", 400);

    const bodega = await buscarBodega(bodegaOrigen);
    const parsed = parsearHseOrdenes(archivo.buffer.toString("latin1"), {
      archivoNombre: archivo.originalname || "",
    });

    const idEnc = idEncDe(parsed.nroPedido);
    const existe = await ordenesModel.findOne({
      $or: [{ nroPedido: parsed.nroPedido }, { idEnc }, { nroPedido: String(parsed.nroPedido).trim() }],
    });
    if (existe && !["anulado"].includes(String(existe.estado || "").toLowerCase())) {
      return fail(
        res,
        `La orden ${parsed.nroPedido} ya está cargada (${existe.idEnc}, estado: ${existe.estado}). Cámbiela a Anuladas o anúlela antes de volver a cargar.`,
        400
      );
    }

    const glnEntrega = parsed.glnEntrega || parsed.glnComprador || "";
    const tienda = (await resolverTiendaPorGln(glnEntrega)) || {};
    const { lineas, avisos, cacheGln } = await enriquecerLineas(parsed.lineas, { glnEntrega });
    const puntosVenta = await puntosVentaDe(parsed.glnsHijos || [], cacheGln);
    const tieneHijos = Boolean(parsed.tieneHijos || puntosVenta.length);
    if (!tienda.nombreEstablecimiento) {
      avisos.push(
        tieneHijos
          ? `Sin nombre de CEDI (madre) para GLN ${glnEntrega || "—"}. Revise códigos EAN.`
          : `Sin nombre de tienda para GLN ${glnEntrega || "—"}. Revise códigos EAN (localización = GLN).`
      );
    }
    if (tieneHijos && puntosVenta.some((p) => !p.nombreEstablecimiento)) {
      const sinNombre = puntosVenta.filter((p) => !p.nombreEstablecimiento).length;
      avisos.push(`${sinNombre} PDV hijo(s) sin nombre en catálogo EAN.`);
    }
    const totales = totalesDe(lineas);
    const payload = {
      idEnc,
      nroPedido: parsed.nroPedido,
      fecha: parsed.fecha || new Date().toISOString().slice(0, 10),
      fechaEntregaDesde: parsed.fechaEntregaDesde,
      fechaEntregaHasta: parsed.fechaEntregaHasta,
      usuario: usuarioDe(req),
      bodegaOrigen: bodega?.codigo || bodegaOrigen,
      bodegaOrigenNombre: bodega?.nombre || req.body?.bodegaOrigenNombre || bodegaOrigen,
      glnProveedor: parsed.glnProveedor,
      glnComprador: parsed.glnComprador,
      glnEntrega: parsed.glnEntrega,
      glnCedi: parsed.glnCedi || parsed.glnEntrega || "",
      glnFacturar: parsed.glnFacturar,
      glnGrupo: parsed.glnGrupo,
      estructura: parsed.estructura || (tieneHijos ? "madre-hijos" : "simple"),
      tieneHijos,
      puntosVenta,
      nombreEstablecimiento: tienda.nombreEstablecimiento || "",
      codigoEstablecimiento: tienda.codigoEstablecimiento || tienda.codigoDep || "",
      codigoDep: tienda.codigoDep || tienda.codigoEstablecimiento || "",
      zona: tienda.zona || "",
      dependencia: tienda.nombreEstablecimiento || tienda.dependencia || "",
      cadena: tienda.cadena || tienda.razonSocial || "",
      razonSocial: tienda.razonSocial || "",
      observacion: parsed.observacion,
      pagoDias: parsed.pagoDias,
      archivoNombre: archivo.originalname || "",
      avisos,
      estado: "aprobado",
      idCargue: null,
      lineas,
      peso: totales.peso,
      unidades: totales.unidades,
      valor: totales.valor,
      fecha_actualizacion: new Date(),
    };

    if (existe) {
      existe.set(payload);
      existe.markModified("lineas");
      existe.markModified("avisos");
      existe.markModified("puntosVenta");
      await existe.save();
      return ok(res, resumen(existe.toObject()));
    }

    const body = await new ordenesModel({
      idOc: await siguienteId(),
      ...payload,
    }).save();

    return ok(res, resumen(body.toObject()), 201);
  } catch (error) {
    console.error("oc.importarHse:", error.message);
    return fail(res, error.message || "No se pudo importar el archivo .hse.", 400);
  }
};

ocCtr.anular = async (req, res) => {
  try {
    const doc = await ordenesModel.findById(req.params._id);
    if (!doc) return fail(res, "No se encontró la orden de compra.", 404);
    if (["despachado", "anulado"].includes(doc.estado)) {
      return fail(res, "Esta orden ya no se puede anular.", 400);
    }
    const enCargue = await carguesModel
      .findOne({ estado: { $in: ["pendiente", "enviado"] }, "documentos.idEnc": doc.idEnc })
      .lean();
    if (enCargue) {
      return fail(res, `La orden está en el cargue ${enCargue.idCargue}. Quítela antes de anular.`, 400);
    }
    doc.estado = "anulado";
    doc.fecha_actualizacion = new Date();
    await doc.save();
    return ok(res, resumen(doc.toObject()));
  } catch (error) {
    return fail(res, "No se pudo anular la orden de compra.", 500);
  }
};

export default ocCtr;
