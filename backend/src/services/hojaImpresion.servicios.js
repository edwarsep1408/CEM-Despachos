import moment from "moment-timezone";
import mongoose from "mongoose";
import carguesModel from "../models/cargues.models";
import facturasModel from "../models/facturas.models";
import itemsModel from "../models/items.models";
import pedidosModel from "../models/pedidos.models";
import { parsearFechaLote } from "./vidaUtil.servicios";
import { normalizarLineaPiso } from "./piso.servicios";
import { lineasDePedido } from "./siesaPedidos.servicios";
import { kgDeToneladas, toneladasDeCapacidad } from "../data/vehiculos.catalogo";

const ZONA = "America/Bogota";
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const num = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const txt = (valor) => String(valor ?? "").trim();

const configPlanta = () => ({
  codigo: process.env.CERT_PLANTA_CODIGO || "028AD",
  nombre: process.env.CERT_PLANTA_NOMBRE || "CARNICOS Y ALIMENTOS S.A.S",
  direccion:
    process.env.CERT_PLANTA_DIRECCION ||
    "Carrera 62 B # 33 Sur 93 Vereda La Verde San Antonio de Prado",
  ciudad: process.env.CERT_PLANTA_CIUDAD || "MEDELLIN,ANTIOQUIA",
  telefono: process.env.CERT_PLANTA_TELEFONO || "6042861520 Ext 150",
  celular: process.env.CERT_PLANTA_CELULAR || "3176652307",
  auxiliar: process.env.CERT_AUXILIAR_CALIDAD || "SERGIO GIRALDO",
  supervisor: process.env.CERT_SUPERVISOR_LOGISTICA || "LEONARDO MONTOYA",
});

const fechaLarga = (iso) => {
  const m = moment.tz(iso || undefined, ZONA);
  if (!m.isValid()) return txt(iso);
  return `${m.date()} de ${MESES[m.month()]} de ${m.year()}`;
};

const fechaCorta = (iso) => {
  const m = moment.tz(String(iso || "").slice(0, 10), ZONA);
  if (!m.isValid()) return txt(iso);
  return m.format("DD/MM/YYYY");
};

const esCredito = (cndPago) => /cred/i.test(txt(cndPago));

const tempDeFrio = (estadoFrio, pesajeTemp) => {
  if (txt(pesajeTemp)) return txt(pesajeTemp);
  const frio = txt(estadoFrio).toUpperCase();
  if (frio.includes("CONGEL")) return "-19";
  if (frio.includes("REFRIGER") || frio.includes("FAENADO")) return "1.2";
  return "";
};

const especieDe = (item = {}) => {
  const raw = `${item.linea || ""} ${item.descTipoInventario || ""} ${item.descCorta || ""}`.toUpperCase();
  if (/PORCIN|CERDO/.test(raw)) return "PORCINA";
  if (/BOVIN|RES|VACUN/.test(raw)) return "BOVINA";
  if (/PESCAD|PEZ/.test(raw)) return "PESCADOS";
  return "AVIAR";
};

const loteImpreso = (lote) => {
  const s = txt(lote);
  if (!s || s === "0") return "";
  const iso = parsearFechaLote(s);
  if (iso) return iso.slice(2, 10).replace(/-/g, "");
  return s.replace(/-/g, "");
};

const fechaBeneficio = (lote) => {
  const iso = parsearFechaLote(lote);
  if (!iso) return "";
  return iso.replace(/-/g, "");
};

const consecutivoFactura = (nroFactura, fallback) => {
  const digits = txt(nroFactura).replace(/\D/g, "");
  if (digits) return digits.slice(-6).padStart(6, "0");
  return String(fallback || 0).padStart(6, "0");
};

const claveItem = (valor) => txt(valor).toUpperCase();

const itemDeMapa = (mapa, linea = {}) => {
  const keys = [linea.referencia, linea.codigo, linea.codigoItem, linea.producto];
  for (const key of keys) {
    const found = mapa.get(claveItem(key));
    if (found) return found;
  }
  return {};
};

const agruparPesajes = (linea) => {
  const grupos = new Map();
  const pesajes = Array.isArray(linea.pesajes) ? linea.pesajes : [];
  if (!pesajes.length) {
    return [
      {
        unid: num(linea.cd) || num(linea.unidades) || num(linea.cantidad),
        peso: num(linea.pd) || num(linea.kilos) || num(linea.kilo) || num(linea.pesoPedido),
        lote: "",
        temperatura: "",
        vence: "",
        refs: [claveItem(linea.referencia || linea.codigo || linea.item)],
      },
    ];
  }
  for (const p of pesajes) {
    const lote = txt(p.lote);
    const vence = txt(p.fechaVencimiento);
    const temp = txt(p.temperatura);
    const clave = `${lote}|${vence}|${temp}`;
    const actual = grupos.get(clave) || {
      unid: 0,
      peso: 0,
      lote,
      temperatura: temp,
      vence,
      refs: [],
    };
    actual.unid += num(p.unidades);
    actual.peso += num(p.pNeto);
    for (const key of [linea.referencia, linea.codigo, linea.item, p.referencia, p.codigo]) {
      const c = claveItem(key);
      if (c && !actual.refs.includes(c)) actual.refs.push(c);
    }
    grupos.set(clave, actual);
  }
  return [...grupos.values()];
};

const pesajesPorReferencia = (docCargue) => {
  const mapa = new Map();
  if (!docCargue) return mapa;
  for (const raw of docCargue.lineas || []) {
    const linea = normalizarLineaPiso(raw);
    if (linea.omitido) continue;
    for (const grupo of agruparPesajes(linea)) {
      for (const ref of grupo.refs || []) {
        if (!ref || mapa.has(ref)) continue;
        mapa.set(ref, grupo);
      }
    }
  }
  return mapa;
};

const lineasDesdeCargue = (docCargue, itemsMap) => {
  if (!docCargue) return [];
  const out = [];
  for (const raw of docCargue.lineas || []) {
    const linea = normalizarLineaPiso(raw);
    if (linea.omitido) continue;
    const item = itemDeMapa(itemsMap, linea);
    const producto = txt(linea.producto || linea.descripcion || item.descripcion || linea.referencia);
    if (!producto) continue;
    for (const grupo of agruparPesajes(linea)) {
      if (!(grupo.unid > 0 || grupo.peso > 0)) continue;
      out.push({
        producto,
        concepto: "APROBADO",
        especie: especieDe(item),
        unid: Number(grupo.unid.toFixed(2)),
        peso: Number(grupo.peso.toFixed(2)),
        lote: loteImpreso(grupo.lote),
        fechaBeneficio: fechaBeneficio(grupo.lote),
        vence: txt(grupo.vence),
        temperatura: tempDeFrio(linea.estadoFrio || item.estadoFrio, grupo.temperatura),
        observaciones: "",
      });
    }
  }
  return out;
};

const unidDeLineaFactura = (linea) => {
  const unidades = num(linea.unidades);
  if (unidades > 0) return unidades;
  return num(linea.cantidad);
};

const crudasDesdeFactura = (factura) => {
  const out = [];
  for (const linea of factura?.lineas || []) {
    const referencia = txt(linea.referencia || linea.codigo);
    const producto = txt(linea.concepto || linea.descripcion || linea.producto || referencia);
    if (!referencia && !producto) continue;
    out.push({
      referencia,
      producto,
      unidades: unidDeLineaFactura(linea),
      kilos: linea.kilos,
      estadoFrio: linea.estadoFrio,
    });
  }
  return out;
};

const crudasDesdePedido = (pedido) => {
  const out = [];
  for (const linea of lineasDePedido(pedido)) {
    const referencia = txt(linea.codigo || linea.referencia);
    const producto = txt(linea.producto || linea.descripcion || referencia);
    if (!referencia && !producto) continue;
    out.push({
      referencia,
      producto,
      unidades: linea.unidades || linea.cant || linea.cd || linea.cantidad,
      kilos: linea.kilo || linea.kilos || linea.cant2 || linea.pd,
      estadoFrio: linea.estadoFrio,
    });
  }
  return out;
};

const mapearLineasCert = (crudas, itemsMap, docCargue) => {
  const extra = pesajesPorReferencia(docCargue);
  return crudas
    .map((linea) => {
      const item = itemDeMapa(itemsMap, linea);
      const producto = txt(item.descripcion || item.descCorta || linea.producto || linea.referencia);
      if (!producto) return null;
      const pesaje =
        extra.get(claveItem(linea.referencia)) ||
        extra.get(claveItem(item.codigoItem)) ||
        extra.get(claveItem(item.item)) ||
        extra.get(claveItem(item.referencia));
      const unid = pesaje?.unid > 0 ? pesaje.unid : num(linea.unidades);
      const peso = pesaje?.peso > 0 ? pesaje.peso : num(linea.kilos);
      return {
        producto,
        concepto: "APROBADO",
        especie: especieDe(item),
        unid: Number(num(unid).toFixed(2)),
        peso: Number(num(peso).toFixed(2)),
        lote: loteImpreso(pesaje?.lote),
        fechaBeneficio: fechaBeneficio(pesaje?.lote),
        vence: txt(pesaje?.vence),
        temperatura: tempDeFrio(linea.estadoFrio || item.estadoFrio, pesaje?.temperatura),
        observaciones: "",
      };
    })
    .filter((linea) => linea && (linea.unid > 0 || linea.peso > 0));
};

const lineasDesdeFacturaOPedido = (factura, pedido, itemsMap, docCargue) => {
  const deFactura = mapearLineasCert(crudasDesdeFactura(factura), itemsMap, docCargue);
  if (deFactura.length) return deFactura;
  return mapearLineasCert(crudasDesdePedido(pedido), itemsMap, docCargue);
};

const docTienePesajes = (docCargue) =>
  (docCargue?.lineas || []).some((linea) => Array.isArray(linea.pesajes) && linea.pesajes.length);

const armarImpresionHoja = async (hoja = {}) => {
  const planta = configPlanta();
  const docs = Array.isArray(hoja.documentos) ? hoja.documentos : [];
  const pedidoIds = [...new Set(docs.map((d) => txt(d.pedidoIdEnc)).filter(Boolean))];
  const facturasNro = [...new Set(docs.map((d) => txt(d.nroFactura)).filter(Boolean))];
  const cargueOids = docs.map((d) => d.cargueId).filter((id) => mongoose.isValidObjectId(id));
  const idCargues = [...new Set(docs.map((d) => d.idCargue).filter((v) => v != null && v !== ""))];

  const orCargues = [
    ...(cargueOids.length ? [{ _id: { $in: cargueOids } }] : []),
    ...(idCargues.length ? [{ idCargue: { $in: idCargues } }] : []),
    ...(pedidoIds.length ? [{ "documentos.idEnc": { $in: pedidoIds } }] : []),
    ...(facturasNro.length ? [{ "documentos.nroDoc": { $in: facturasNro } }] : []),
  ];
  const [pedidos, facturas, cargues] = await Promise.all([
    pedidoIds.length ? pedidosModel.find({ idEnc: { $in: pedidoIds } }).lean() : [],
    facturasNro.length
      ? facturasModel.find({ numFactura: { $in: facturasNro } }).lean()
      : [],
    orCargues.length ? carguesModel.find({ $or: orCargues }).lean() : [],
  ]);

  const pedidoPorId = new Map(pedidos.map((p) => [txt(p.idEnc), p]));
  const facturaPorNro = new Map(facturas.map((f) => [txt(f.numFactura).toUpperCase(), f]));
  const carguePorOid = new Map(cargues.map((c) => [String(c._id), c]));
  const carguePorNumero = new Map(cargues.map((c) => [String(c.idCargue), c]));

  const matchDocCargue = (d, doc) => {
    const idEnc = txt(doc.pedidoIdEnc);
    const nro = txt(doc.nroFactura).toUpperCase();
    const enc = txt(d.idEnc);
    const nd = txt(d.nroDoc).toUpperCase();
    return (
      (idEnc && (enc === idEnc || nd === idEnc.toUpperCase())) ||
      (nro && (nd === nro || enc.toUpperCase() === nro))
    );
  };

  const docCargueDe = (doc) => {
    const cargue =
      (doc.cargueId && carguePorOid.get(String(doc.cargueId))) ||
      (doc.idCargue != null && doc.idCargue !== "" && carguePorNumero.get(String(doc.idCargue))) ||
      cargues.find((c) => (c.documentos || []).some((d) => matchDocCargue(d, doc))) ||
      null;
    if (!cargue) return null;
    return (cargue.documentos || []).find((d) => matchDocCargue(d, doc)) || null;
  };

  const refs = new Set();
  const addRef = (valor) => {
    const s = txt(valor);
    if (s) refs.add(s);
  };
  for (const factura of facturas) {
    for (const linea of factura.lineas || []) addRef(linea.referencia);
  }
  for (const pedido of pedidos) {
    for (const linea of lineasDePedido(pedido)) {
      addRef(linea.referencia);
      addRef(linea.codigo);
    }
  }
  for (const cargue of cargues) {
    for (const doc of cargue.documentos || []) {
      for (const linea of doc.lineas || []) {
        addRef(linea.referencia);
        addRef(linea.codigo);
      }
    }
  }
  const items = refs.size
    ? await itemsModel
        .find({
          $or: [
            { referencia: { $in: [...refs] } },
            { codigoItem: { $in: [...refs] } },
            { item: { $in: [...refs] } },
          ],
        })
        .lean()
    : [];
  const itemsMap = new Map();
  for (const item of items) {
    for (const key of [item.referencia, item.codigoItem, item.item]) {
      if (txt(key)) itemsMap.set(claveItem(key), item);
    }
  }

  const ahora = moment.tz(ZONA);
  const fechaHoja = hoja.fecha || ahora.format("YYYY-MM-DD");
  const filas = [];
  const certificados = [];
  let totalContado = 0;
  let totalCredito = 0;
  let totalPeso = 0;
  let totalDestare = 0;
  let totalValor = 0;
  const clientes = new Set();

  docs.forEach((doc, index) => {
    const pedido = pedidoPorId.get(txt(doc.pedidoIdEnc)) || {};
    const factura = facturaPorNro.get(txt(doc.nroFactura).toUpperCase()) || {};
    const valor = num(doc.valor || factura.valor || pedido.valor);
    const peso = num(factura.peso) || num(doc.pesoDetTara ?? doc.peso);
    const destare = num(doc.destare);
    const credito = esCredito(doc.cndPago || pedido.cp);
    const cliente =
      txt(doc.cliente) ||
      txt(factura.razonSocial) ||
      txt(pedido.cliente) ||
      "";
    const sucursal =
      txt(pedido.contacto) ||
      txt(doc.sucursal) ||
      txt(factura.sucursal) ||
      txt(pedido.sucursalDescripcion) ||
      "";
    const establecimiento = txt(pedido.establecimiento || factura.sucursal);
    const clienteImpreso =
      establecimiento && cliente && !cliente.includes(establecimiento)
        ? `${cliente} - ${establecimiento}`
        : cliente;
    if (cliente) clientes.add(cliente);
    totalValor += valor;
    totalPeso += peso;
    totalDestare += destare;
    if (credito) totalCredito += valor;
    else totalContado += valor;

    filas.push({
      nroDoc: txt(doc.nroFactura) || txt(doc.pedidoIdEnc),
      sucursal,
      cliente: clienteImpreso,
      direccion: txt(
        pedido.direccionPed ||
          pedido.direccion ||
          doc.direccion ||
          factura.direccion ||
          factura.sucursal
      ),
      barrio: txt(doc.barrio || pedido.barrioPed || pedido.barrio),
      municipio: txt(doc.municipio || pedido.municipio),
      peso,
      destare,
      destareTxt:
        index === 0 && (num(hoja.canastas) || num(hoja.bultos))
          ? [num(hoja.canastas) ? `${num(hoja.canastas)} CTS` : "", num(hoja.bultos) ? `${num(hoja.bultos)} BTS` : ""]
              .filter(Boolean)
              .join(", ")
          : "",
      contado: credito ? 0 : valor,
      credito: credito ? valor : 0,
    });

    const docCargue = docCargueDe(doc);
    let lineas = [];
    if (docTienePesajes(docCargue)) lineas = lineasDesdeCargue(docCargue, itemsMap);
    if (!lineas.length) lineas = lineasDesdeFacturaOPedido(factura, pedido, itemsMap, docCargue);
    if (!lineas.length) lineas = lineasDesdeCargue(docCargue, itemsMap);
    const year = String(fechaHoja).slice(0, 4) || String(ahora.year());
    certificados.push({
      numero: `${planta.codigo}-${consecutivoFactura(doc.nroFactura, Number(hoja.idHoja) * 100 + index + 1)}-${year}`,
      fechaExpedicion: fechaCorta(ahora.format("YYYY-MM-DD")),
      fechaDespacho: fechaLarga(fechaHoja),
      horaDespacho: ahora.format("HH:mm:ss"),
      cliente: clienteImpreso,
      direccion: txt(
        pedido.direccionPed ||
          pedido.direccion ||
          doc.direccion ||
          factura.direccion ||
          factura.sucursal
      ),
      municipio: txt(doc.municipio || pedido.municipio || factura.municipio),
      observaciones: txt(pedido.observacion || hoja.observaciones),
      lineas,
      placa: txt(hoja.placa),
      temperaturaVehiculo: txt(hoja.temperatura),
      firmanteCalidad: hoja.firmanteCalidad || null,
      firmanteLogistica: hoja.firmanteLogistica || null,
    });
  });

  const capacidadTon = toneladasDeCapacidad(hoja.capacidad);
  const bruto = totalPeso + totalDestare + num(hoja.pesoAdicional);
  const baseKg = kgDeToneladas(capacidadTon);
  const ocupacion = baseKg > 0 ? Number(((bruto / baseKg) * 100).toFixed(1)) : 0;

  return {
    planta,
    hoja: {
      idHoja: hoja.idHoja,
      nombre: hoja.nombre,
      fecha: fechaHoja,
      conductor: hoja.conductor,
      placa: hoja.placa,
      telefono: hoja.telefono,
      capacidad: capacidadTon,
      pesoAdicional: num(hoja.pesoAdicional),
      temperatura: hoja.temperatura,
      canastas: hoja.canastas ?? "",
      bultos: hoja.bultos ?? "",
      supervisor: hoja.supervisor,
      despachador: hoja.despachador,
      telDistribucion: hoja.telDistribucion || "",
      facturador: hoja.facturador,
      celularPtoContacto: hoja.celularPtoContacto,
      auxiliar: hoja.auxiliar || "",
      canastasIfco: hoja.canastasIfco || "",
      transportadora: hoja.transportadora,
      observaciones: hoja.observaciones || "",
      usuario: hoja.usuario || "",
    },
    filas,
    certificados,
    totales: {
      valor: Number(totalValor.toFixed(2)),
      peso: Number(totalPeso.toFixed(2)),
      destare: Number(totalDestare.toFixed(2)),
      bruto: Number((totalPeso + totalDestare).toFixed(2)),
      contado: Number(totalContado.toFixed(2)),
      credito: Number(totalCredito.toFixed(2)),
      ocupacion,
      clientes: clientes.size,
      facturas: docs.length,
      salidas: 0,
      transferencias: 0,
    },
  };
};

export { armarImpresionHoja, configPlanta };

export default { armarImpresionHoja, configPlanta };
