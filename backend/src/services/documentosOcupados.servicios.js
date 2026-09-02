import hojaModel from "../models/hojasRuta.models";
import carguesModel from "../models/cargues.models";

const clave = (valor) => String(valor || "").trim().toUpperCase().replace(/\s+/g, "");

const pedidoClave = (valor) => {
  const k = String(valor || "").trim();
  if (!k || k === "0") return "";
  return k;
};

const setSiLibre = (mapa, k, info) => {
  if (!k || mapa.has(k)) return;
  mapa.set(k, info);
};

const ocupacionDocumentos = async () => {
  const [hojas, cargues] = await Promise.all([
    hojaModel
      .find({ estado: { $in: ["temporal", "vigente"] } }, { idHoja: 1, nombre: 1, documentos: 1 })
      .lean(),
    carguesModel
      .find({ estado: { $in: ["pendiente", "enviado"] } }, { idCargue: 1, documentos: 1 })
      .lean(),
  ]);

  const facturas = new Map();
  const pedidosEnHojas = new Map();
  const pedidosEnCargues = new Map();

  for (const hoja of hojas) {
    const info = {
      ambito: "hoja",
      id: String(hoja._id),
      etiqueta: `la hoja de ruta ${hoja.idHoja}`,
    };
    for (const doc of hoja.documentos || []) {
      setSiLibre(facturas, clave(doc.nroFactura), info);
      setSiLibre(pedidosEnHojas, pedidoClave(doc.pedidoIdEnc), info);
    }
  }

  for (const cargue of cargues) {
    const info = {
      ambito: "cargue",
      id: String(cargue._id),
      etiqueta: `el cargue ${cargue.idCargue}`,
    };
    for (const doc of cargue.documentos || []) {
      const idEnc = pedidoClave(doc.idEnc);
      setSiLibre(pedidosEnCargues, idEnc, info);
      const nro = clave(doc.nroFactura || "");
      const nroDoc = clave(doc.nroDoc);
      if (nro) setSiLibre(facturas, nro, info);
      if (nroDoc && nroDoc !== clave(idEnc)) setSiLibre(facturas, nroDoc, info);
    }
  }

  return { facturas, pedidosEnHojas, pedidosEnCargues };
};

const facturaEn = (ocupacion, nroFactura) => ocupacion.facturas.get(clave(nroFactura)) || null;

const pedidoEnHoja = (ocupacion, idEnc) => ocupacion.pedidosEnHojas.get(pedidoClave(idEnc)) || null;

const pedidoEnCargue = (ocupacion, idEnc) => ocupacion.pedidosEnCargues.get(pedidoClave(idEnc)) || null;

const bloqueoFacturaEnHoja = (ocupacion, nroFactura, _hojaId) => {
  return facturaEn(ocupacion, nroFactura);
};

const bloqueoPedidoEnHoja = (ocupacion, idEnc, hojaId) => {
  const info = pedidoEnHoja(ocupacion, idEnc);
  if (!info) return null;
  if (info.id === String(hojaId || "")) return info;
  return info;
};

const bloqueoPedidoEnCargue = (ocupacion, idEnc, cargueId) => {
  const enCargue = pedidoEnCargue(ocupacion, idEnc);
  if (enCargue && enCargue.id !== String(cargueId || "")) return enCargue;
  if (enCargue && enCargue.id === String(cargueId || "")) return enCargue;
  const enHoja = pedidoEnHoja(ocupacion, idEnc);
  if (enHoja) return enHoja;
  return null;
};

const textoOcupado = (nro, info) =>
  `${nro} ya está en ${info?.etiqueta || "otra hoja o cargue"}`;

export {
  bloqueoFacturaEnHoja,
  bloqueoPedidoEnCargue,
  bloqueoPedidoEnHoja,
  clave as claveFactura,
  facturaEn,
  ocupacionDocumentos,
  pedidoClave,
  pedidoEnCargue,
  pedidoEnHoja,
  textoOcupado,
};

export default {
  bloqueoFacturaEnHoja,
  bloqueoPedidoEnCargue,
  bloqueoPedidoEnHoja,
  claveFactura: clave,
  facturaEn,
  ocupacionDocumentos,
  pedidoClave,
  pedidoEnCargue,
  pedidoEnHoja,
  textoOcupado,
};
