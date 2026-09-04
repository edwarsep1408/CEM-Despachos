import { etiquetaMotivo } from "./motivosNovedadRuta";

export const BANCOS_CONSIGNACION = [
  { codigo: "Bancolombia", nombre: "Bancolombia" },
  { codigo: "Davivienda", nombre: "Davivienda" },
  { codigo: "Nequi", nombre: "Nequi" },
  { codigo: "Otro", nombre: "Otro" },
];

export const ESTADOS_HOJA_RUTA = ["temporal", "vigente", "cerrada", "liquidada", "anulada"];
export const ESTADOS_LIQUIDACION = ["sin_liquidar", "pendiente", "paz_y_salvo", "rechazada"];
export const MAX_FOTO_CONSIGNACION = 900000;

const num = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const esFactura = (doc) => {
  const nro = String(doc?.nroFactura || "").trim();
  const tipo = String(doc?.tipoDoc || "").toUpperCase();
  if (!nro) return false;
  if (tipo.includes("REAPRO")) return false;
  return true;
};

export const tipoPagoDe = (cndPago) =>
  /cred/i.test(String(cndPago || "")) ? "CREDITO" : "CONTADO";

export const totalNovedadDe = (doc) =>
  (doc?.entrega?.lineas || []).reduce((acc, l) => acc + (Number(l.valorNovedad) || 0), 0);

export const kilosNovedadDe = (doc) =>
  (doc?.entrega?.lineas || []).reduce(
    (acc, l) =>
      acc +
      (Number(l.kilosDevolucion) || 0) +
      (Number(l.kilosMerma) || 0) +
      (Number(l.kilosFaltante) || 0),
    0
  );

export const recortarFotoConsignacion = (data) => {
  const s = String(data || "").trim();
  if (!s) return "";
  if (!s.startsWith("data:image")) {
    const error = new Error("La foto de la consignación no es válida.");
    error.status = 400;
    throw error;
  }
  if (s.length > MAX_FOTO_CONSIGNACION) {
    const error = new Error(
      "La foto de la consignación es demasiado pesada. Tome de nuevo más cerca o con menos zoom."
    );
    error.status = 400;
    throw error;
  }
  return s;
};

const ahoraBogota = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    fecha: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}`,
  };
};

export const sanitizarConsignacion = (row = {}, { usuario, origen }) => {
  const valor = Math.max(0, num(row.valor));
  const referencia = String(row.referencia || "").trim();
  const foto = recortarFotoConsignacion(row.foto);
  if (valor <= 0) {
    const error = new Error("Indique el valor de la consignación.");
    error.status = 400;
    throw error;
  }
  if (!referencia) {
    const error = new Error("La referencia de la consignación es obligatoria.");
    error.status = 400;
    throw error;
  }
  if (!foto) {
    const error = new Error("Adjunte la foto del comprobante de consignación.");
    error.status = 400;
    throw error;
  }
  const ahora = ahoraBogota();
  const banco = String(row.banco || "Bancolombia").trim() || "Bancolombia";
  return {
    banco,
    valor,
    referencia,
    fecha: String(row.fecha || "").trim() || ahora.fecha,
    hora: String(row.hora || "").trim() || ahora.hora,
    foto,
    cuenta: String(row.cuenta || "").trim(),
    usuario: usuario || "",
    origen: origen === "analista" ? "analista" : "conductor",
    fecha_creacion: new Date(),
  };
};

export const presentarConsignacion = (row = {}, { conFoto = true } = {}) => ({
  _id: row._id ? String(row._id) : "",
  banco: row.banco || "Bancolombia",
  valor: num(row.valor),
  referencia: row.referencia || "",
  fecha: row.fecha || "",
  hora: row.hora || "",
  cuenta: row.cuenta || "",
  usuario: row.usuario || "",
  origen: row.origen || "conductor",
  foto: conFoto ? row.foto || "" : "",
  tieneFoto: Boolean(row.foto),
});

export const centroDeHoja = (hoja) => {
  const counts = {};
  for (const doc of (hoja.documentos || []).filter(esFactura)) {
    const b = String(doc.bodega || "").trim() || "SIN BODEGA";
    counts[b] = (counts[b] || 0) + 1;
  }
  let best = "SIN BODEGA";
  let n = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
};

export const evaluarLiquidacion = (hoja = {}) => {
  const facturas = (hoja.documentos || []).filter(esFactura);
  const liq = hoja.liquidacion || {};
  const gastos = Math.max(0, num(liq.gastosOperativos));
  const monedas = Math.max(0, num(liq.monedas));
  let despachado = 0;
  let devuelto = 0;
  let valorContado = 0;
  let novedadesContado = 0;
  let recaudosElectronicos = 0;
  let entregados = 0;
  for (const doc of facturas) {
    const valor = num(doc.valor);
    const nov = num(totalNovedadDe(doc));
    const tipo = doc.entrega?.tipoPago || tipoPagoDe(doc.cndPago);
    const credito = String(tipo).toUpperCase() === "CREDITO";
    despachado += valor;
    devuelto += nov;
    const est = String(doc.entrega?.estado || "pendiente").toLowerCase();
    if (est && est !== "pendiente") entregados += 1;
    if (!credito) {
      valorContado += valor;
      novedadesContado += nov;
      recaudosElectronicos += (doc.recaudos || []).reduce((acc, r) => acc + num(r.monto), 0);
    }
  }
  const consignadoEfectivo = (hoja.consignaciones || []).reduce((acc, c) => acc + num(c.valor), 0);
  const consignado = recaudosElectronicos + consignadoEfectivo;
  const ejecutado = despachado - devuelto;
  const esperadoEfectivo = valorContado - novedadesContado - recaudosElectronicos - gastos - monedas;
  const pendiente = esperadoEfectivo - consignadoEfectivo;
  const estadoLiquidacion = liq.estado || "sin_liquidar";
  const pazYSalvo = estadoLiquidacion === "paz_y_salvo" || Math.abs(pendiente) <= 1;
  return {
    pedidos: facturas.length,
    entregados,
    pendientesEntrega: Math.max(0, facturas.length - entregados),
    cumplimiento: facturas.length ? Math.round((entregados / facturas.length) * 100) : 0,
    despachado,
    ejecutado,
    devuelto,
    valorContado,
    novedadesContado,
    recaudosElectronicos,
    consignadoEfectivo,
    consignado,
    gastos,
    monedas,
    esperadoEfectivo,
    pendiente,
    pazYSalvo,
    estadoLiquidacion,
    estadoHoja: hoja.estado || "",
    alarma: estadoLiquidacion !== "paz_y_salvo",
  };
};

export const devolucionesDe = (hoja = {}) =>
  (hoja.documentos || [])
    .filter(esFactura)
    .filter((doc) => {
      const est = String(doc.entrega?.estado || "pendiente").toLowerCase();
      return est === "parcial" || est === "no_entregado" || totalNovedadDe(doc) > 0;
    })
    .map((doc) => ({
      docId: String(doc._id),
      nroFactura: doc.nroFactura || "",
      cliente: doc.cliente || "",
      valor: num(totalNovedadDe(doc)),
      kilos: Math.round(kilosNovedadDe(doc) * 100) / 100 || num(doc.peso),
      motivo: etiquetaMotivo(doc.entrega?.motivo) || doc.entrega?.motivo || "",
      estado: doc.entrega?.estado || "pendiente",
      origen: doc.entrega?.usuario ? "CONDUCTOR" : "MANUAL",
    }));

export const presentarCierre = (hoja = {}) => {
  const c = hoja.cierre || {};
  return {
    fecha: c.fecha || null,
    usuario: c.usuario || "",
    observaciones: c.observaciones || "",
  };
};

export const presentarLiquidacion = (hoja = {}) => {
  const l = hoja.liquidacion || {};
  const cruce = evaluarLiquidacion(hoja);
  return {
    gastosOperativos: cruce.gastos,
    monedas: cruce.monedas,
    observaciones: l.observaciones || "",
    estado: cruce.estadoLiquidacion,
    aprobadoPor: l.aprobadoPor || "",
    fechaAprobacion: l.fechaAprobacion || null,
    ...cruce,
  };
};

export const puedeEditarLiquidacion = (hoja) => {
  const est = hoja?.liquidacion?.estado || "sin_liquidar";
  return est !== "paz_y_salvo";
};

export const facturasPendientes = (hoja) =>
  (hoja.documentos || [])
    .filter(esFactura)
    .filter((d) => String(d.entrega?.estado || "pendiente").toLowerCase() === "pendiente");
