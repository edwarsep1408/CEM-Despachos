import axios from "axios";

/**
 * Connekta v3: carnicosyalimentos_Prevalentware_facturas
 * No admite parámetros de fecha. Una fila = línea de factura.
 * Relación pedido: NumPedido + TipoDocPedido + id430.
 * Cabecera: TipoDoc + NumDoc. Peso: sum(CantidadKilos).
 */

const nombreClave = (name) => String(name).toLowerCase().replace(/[\s_]/g, "");

const pick = (row, keys) => {
  const entries = Object.entries(row || {});
  for (const key of keys) {
    const wanted = nombreClave(key);
    const found = entries.find(([name]) => nombreClave(name) === wanted);
    if (!found) continue;
    const value = found[1];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text !== "") return typeof value === "string" ? text : value;
  }
  return "";
};

const extraerFilas = (payload) => {
  const detalle = payload?.detalle;
  const candidatos = [
    detalle?.Datos,
    detalle?.datos,
    detalle?.Table,
    detalle?.table,
    detalle,
    payload?.Datos,
    payload?.Table,
  ];
  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      return candidato.map((row) => {
        if (!row || typeof row !== "object") return row;
        return Object.fromEntries(
          Object.entries(row).map(([key, value]) => [String(key).trim(), value])
        );
      });
    }
  }
  return [];
};

const metaPaginacion = (payload) => {
  const detalle = payload?.detalle || {};
  return {
    totalPaginas: Number(detalle.total_páginas || detalle.total_paginas || 0),
    totalRegistros: Number(detalle.total_registros || 0),
  };
};

const normalizarBaseUrl = (raw) => {
  let url = (raw || "").trim();
  if (!url) return "";
  const corte = url.indexOf("?");
  return corte >= 0 ? url.slice(0, corte) : url;
};

const extraerQuery = (raw) => {
  const url = (raw || "").trim();
  const corte = url.indexOf("?");
  if (corte < 0) return {};
  try {
    return Object.fromEntries(new URL(url).searchParams.entries());
  } catch (_error) {
    return {};
  }
};

const configFacturas = () => {
  const key = process.env.SIESA_PEDIDOS_CONNI_KEY || "";
  const token = process.env.SIESA_PEDIDOS_CONNI_TOKEN || "";
  const rawUrl =
    process.env.SIESA_FACTURAS_BASE_URL || process.env.SIESA_PEDIDOS_BASE_URL || "";
  const query = extraerQuery(rawUrl);
  return {
    baseUrl: normalizarBaseUrl(rawUrl),
    idCompania:
      process.env.SIESA_PEDIDOS_ID_COMPANIA ||
      query.idCompania ||
      process.env.SIESA_ID_COMPANIA ||
      "55",
    consulta:
      process.env.SIESA_CONSULTA_FACTURAS ||
      "carnicosyalimentos_Prevalentware_facturas",
    headers: {
      "Content-Type": "application/json",
      ConnKey: key,
      ConnToken: token,
      ConniKey: key,
      ConniToken: token,
    },
  };
};

const fechaDeFila = (row) =>
  String(
    pick(row, ["Fecha", "Fecha2", "f461_id_fecha", "Id_fecha", "FECHA", "fecha"]) || ""
  ).slice(0, 10);

const numFacturaDe = (row) => {
  const tipo = String(pick(row, ["TipoDoc", "Id_tipo_docto", "f350_id_tipo_docto"]) || "").trim();
  const consec = String(pick(row, ["NumDoc", "Consec_docto", "f350_consec_docto"]) || "").trim();
  const referencia = String(pick(row, ["DocReferencia", "NumFactura", "NUM_FACTURA", "num_factura"]) || "").trim();
  if (tipo && consec) return `${tipo}-${consec}`;
  return referencia || consec;
};

const numPedidoDe = (row) =>
  String(
    pick(row, ["NumPedido", "NRO_DOC", "nroDoc", "f430_consec_docto", "ConsecPedido", "idEnc"]) || ""
  ).trim();

const mapLineaFactura = (row) => ({
  linea: Number(pick(row, ["LineaRegistro", "linea", "f470_nro_registro"]) || 0) || 0,
  referencia: String(
    pick(row, [
      "Referencia",
      "referencia",
      "f120_referencia",
      "item referencia",
      "item_referencia",
      "Id_item",
      "codigo",
    ]) || ""
  ).trim(),
  um: String(pick(row, ["UM", "unidad", "undInventario"]) || "").trim(),
  cantidad: Number(pick(row, ["Cantidad", "Cant1", "cant"]) || 0) || 0,
  kilos: Number(pick(row, ["CantidadKilos", "PesoMovOriginal", "Cant2", "kilos"]) || 0) || 0,
  unidades: Number(pick(row, ["Unidades", "Cantidad", "Cant1"]) || 0) || 0,
  valorBruto: Number(pick(row, ["ValorBrutoMov"]) || 0) || 0,
  concepto: String(
    pick(row, ["Concepto", "DescripcionItem", "item descripcion", "item_descripcion", "producto"]) || ""
  ).trim(),
  motivo: String(pick(row, ["Motivo", "DescripcionMotivo"]) || "").trim(),
});

const mapFacturaFila = (row) => {
  const tipoDoc = String(pick(row, ["TipoDoc", "Id_tipo_docto", "f350_id_tipo_docto"]) || "").trim();
  const numPedido = numPedidoDe(row);
  const nit = String(pick(row, ["Nit", "NIT", "f200_nit"]) || "").trim();
  const sucursalNombre = String(pick(row, ["NombreEstablecimiento"]) || "").trim();
  const sucursalCodigo = String(pick(row, ["Sucursal", "Id_sucursal_fact"]) || "").trim();
  const vrNeto = Number(pick(row, ["VrNeto", "Valor", "VALOR", "f461_vlr_neto"]) || 0) || 0;
  const vrBruto = Number(pick(row, ["VrBruto", "f461_vlr_bruto"]) || 0) || 0;
  const vrDscto = Number(pick(row, ["VrDscto", "f461_vlr_dscto"]) || 0) || 0;
  const linea = mapLineaFactura(row);
  return {
    id461: numFacturaDe(row),
    id430: String(pick(row, ["id430", "f430_rowid"]) || "").trim(),
    numFactura: numFacturaDe(row),
    tipoDoc: tipoDoc || "FACTURA",
    nroDoc: numPedido || "0",
    nit: nit && sucursalCodigo && !nit.includes("-") ? `${nit}-${sucursalCodigo}` : nit,
    razonSocial: String(pick(row, ["RazonSocial", "razon_social", "f200_razon_social"]) || "").trim(),
    sucursal: sucursalNombre || sucursalCodigo,
    direccion: String(pick(row, ["Direccion", "DIRECCION", "direccion", "dir"]) || "").trim(),
    contacto: String(pick(row, ["Contacto", "CONTACTO", "contacto"]) || "").trim(),
    barrio: String(pick(row, ["Barrio", "BARRIO", "barrio"]) || "").trim(),
    municipio: String(pick(row, ["Municipio", "MUNICIPIO", "Ciudad", "ciudad"]) || "").trim(),
    fecha: fechaDeFila(row),
    valor: vrNeto || Number((vrBruto - vrDscto).toFixed(2)) || vrBruto,
    peso:
      Number(pick(row, ["CantidadKilos", "PesoMovOriginal", "Peso", "peso"]) || 0) ||
      Number(linea.kilos) ||
      0,
    unidades: linea.unidades,
    bodega: String(pick(row, ["Id_bodega", "BODEGA", "bodega", "f470_id_bodega"]) || "").trim(),
    vendedor: String(pick(row, ["Desc_vendedor", "Vendedor", "VENDEDOR", "f210_id"]) || "").trim(),
    numPedido,
    tipoDocPedido: String(pick(row, ["TipoDocPedido"]) || "").trim(),
    cndPago: String(pick(row, ["DescCondPago", "IdCondPago", "CND_PAGO"]) || "").trim(),
    sep: String(pick(row, ["SEP", "sep"]) || "").trim(),
    co: String(pick(row, ["Co", "COPedido", "Id_co"]) || "").trim(),
    notas: String(pick(row, ["Notas"]) || "").trim(),
    lineas: linea.referencia || linea.concepto ? [linea] : [],
  };
};

const agruparFacturas = (filas) => {
  const porClave = new Map();
  for (const row of filas) {
    const mapped = mapFacturaFila(row);
    if (!mapped.numFactura) continue;
    const actual = porClave.get(mapped.numFactura);
    if (!actual) {
      porClave.set(mapped.numFactura, {
        ...mapped,
        peso: Number(mapped.peso) || 0,
        unidades: Number(mapped.unidades) || 0,
        lineas: [...(mapped.lineas || [])],
      });
      continue;
    }
    actual.peso = Number((Number(actual.peso) + (Number(mapped.peso) || 0)).toFixed(4));
    actual.unidades = Number((Number(actual.unidades) + (Number(mapped.unidades) || 0)).toFixed(4));
    if (!actual.valor && mapped.valor) actual.valor = mapped.valor;
    if (!actual.bodega && mapped.bodega) actual.bodega = mapped.bodega;
    if (!actual.numPedido && mapped.numPedido) actual.numPedido = mapped.numPedido;
    if (!actual.tipoDocPedido && mapped.tipoDocPedido) actual.tipoDocPedido = mapped.tipoDocPedido;
    if (!actual.id430 && mapped.id430) actual.id430 = mapped.id430;
    for (const linea of mapped.lineas || []) {
      const existe = actual.lineas.some(
        (otra) => otra.linea === linea.linea && otra.referencia === linea.referencia
      );
      if (!existe) actual.lineas.push(linea);
    }
  }
  return [...porClave.values()];
};

const pedirPagina = async ({ pagina, pageSize = 100, parametros } = {}) => {
  const { baseUrl, idCompania, consulta, headers } = configFacturas();
  if (!baseUrl) {
    const error = new Error("Falta SIESA_PEDIDOS_BASE_URL en el .env.");
    error.status = 400;
    error.consulta = consulta;
    throw error;
  }
  if (!headers.ConniKey || !headers.ConniToken) {
    const error = new Error("Faltan SIESA_PEDIDOS_CONNI_KEY y SIESA_PEDIDOS_CONNI_TOKEN en el .env.");
    error.status = 400;
    error.consulta = consulta;
    throw error;
  }

  const params = {
    idCompania,
    descripcion: consulta,
    paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
  };
  if (parametros) params.parametros = parametros;

  const timeoutMs = Number(process.env.SIESA_FACTURAS_TIMEOUT_MS || 180000);
  const t0 = Date.now();
  console.log(`[facturas-siesa] GET ${consulta} numPag=${pagina} tamPag=${pageSize}`);
  let response;
  try {
    response = await axios.get(baseUrl, { params, headers, timeout: timeoutMs });
  } catch (error) {
    const http = error.response?.status;
    const detalle =
      typeof error.response?.data?.detalle === "string" ? error.response.data.detalle : "";
    const siesaError = new Error(
      detalle ||
        error.message ||
        `SIESA no respondió ${consulta}. Revise carnicosyalimentos_Prevalentware_facturas en Connekta v3.`
    );
    siesaError.status = http === 401 || http === 403 || http >= 500 ? 502 : http || 502;
    siesaError.consulta = consulta;
    throw siesaError;
  }

  const payload = response.data || {};
  if (payload.codigo && Number(payload.codigo) !== 0) {
    const error = new Error(
      payload.detalle ||
        payload.mensaje ||
        `SIESA rechazó ${consulta}.`
    );
    error.status = 502;
    error.consulta = consulta;
    throw error;
  }

  const meta = metaPaginacion(payload);
  const filas = extraerFilas(payload);
  console.log(
    `[facturas-siesa] OK ${consulta} numPag=${pagina} ${Date.now() - t0}ms filas=${filas.length}`
  );
  return {
    filas,
    pagina,
    totalPaginas: meta.totalPaginas || 1,
    totalRegistros: meta.totalRegistros || filas.length,
  };
};

const descargarFacturasSiesa = async ({ desde, hasta } = {}) => {
  const pageSize = Number(process.env.SIESA_FACTURAS_TAM_PAG || 100);
  const paginaHint = Number(process.env.SIESA_FACTURAS_PAGINA || 1400);
  let lote = await pedirPagina({ pagina: Math.max(1, paginaHint), pageSize });
  if (!(lote.filas || []).length) {
    const ultima = Math.max(1, Number(lote.totalPaginas) || 1);
    lote = await pedirPagina({ pagina: ultima, pageSize });
  }
  if (!(lote.filas || []).length) {
    lote = await pedirPagina({ pagina: 1, pageSize });
  }
  const filas = lote.filas || [];
  const totalPaginas = Math.max(1, Number(lote.totalPaginas) || 1);
  const pagina = lote.pagina || paginaHint;
  const totalRegistros = Number(lote.totalRegistros) || filas.length;
  let aviso = "";
  if (totalPaginas > 1) {
    aviso = `SIESA tiene ${totalRegistros} líneas (${totalPaginas} páginas). Se leyó la página ${pagina} (${filas.length} líneas).`;
  }

  let facturas = agruparFacturas(filas);
  const fechas = facturas.map((item) => String(item.fecha || "")).filter(Boolean).sort();
  const minFecha = fechas[0] || "";
  const maxFecha = fechas[fechas.length - 1] || "";

  if (desde || hasta) {
    const filtradas = facturas.filter((item) => {
      if (desde && String(item.fecha || "") < desde) return false;
      if (hasta && String(item.fecha || "") > hasta) return false;
      return true;
    });
    if (filtradas.length) {
      facturas = filtradas;
    } else if (facturas.length) {
      aviso = [
        aviso,
        `No hay facturas entre ${desde || "…"} y ${hasta || "…"}. Se muestran las de esta página (${minFecha} a ${maxFecha}).`,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }

  return {
    consulta: configFacturas().consulta,
    facturas,
    filasSiesa: filas.length,
    totalRegistros,
    totalPaginas,
    campos: filas[0] ? Object.keys(filas[0]) : [],
    aviso,
    desde,
    hasta,
    minFecha,
    maxFecha,
  };
};

const inspeccionarFacturasSiesa = async () => {
  const lote = await pedirPagina({ pagina: 1, pageSize: 5 });
  const cruda = lote.filas[0] || {};
  const mapeada = lote.filas[0] ? mapFacturaFila(lote.filas[0]) : null;
  const agrupadas = agruparFacturas(lote.filas || []);
  return {
    consulta: configFacturas().consulta,
    baseUrl: configFacturas().baseUrl,
    totalPaginas: lote.totalPaginas,
    totalRegistros: lote.totalRegistros,
    filasPagina: (lote.filas || []).length,
    campos: Object.keys(cruda),
    mapeada,
    facturasEnPagina: agrupadas.length,
  };
};

export {
  agruparFacturas,
  configFacturas,
  descargarFacturasSiesa,
  inspeccionarFacturasSiesa,
  mapFacturaFila,
};

export default {
  agruparFacturas,
  configFacturas,
  descargarFacturasSiesa,
  inspeccionarFacturasSiesa,
  mapFacturaFila,
};
