import axios from "axios";

const txt = (valor) => String(valor ?? "").trim();

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

const num = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const n = Number(String(valor).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const extraerFilas = (payload) => {
  const detalle = payload?.detalle;
  const candidatos = [
    detalle?.Datos,
    detalle?.datos,
    detalle?.Table,
    detalle?.table,
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
  };
};

const configSt = () => {
  const key = txt(process.env.SIESA_EXISTENCIAS_CONNI_KEY);
  const token = txt(process.env.SIESA_EXISTENCIAS_CONNI_TOKEN);
  const rawUrl =
    process.env.SIESA_ST_BASE_URL ||
    process.env.SIESA_EXISTENCIAS_BASE_URL ||
    "https://servicios.siesacloud.com/api/connekta/v3/ejecutarconsulta";
  const corte = rawUrl.indexOf("?");
  return {
    baseUrl: corte < 0 ? rawUrl : rawUrl.slice(0, corte),
    idCompania: process.env.SIESA_ID_COMPANIA || "55",
    consulta:
      process.env.SIESA_CONSULTA_ST ||
      "carnicosyalimentos_carnicosyalimentos_documentos_ST",
    key,
    token,
    headers: {
      "Content-Type": "application/json",
      ConnKey: key,
      ConnToken: token,
      ConniKey: key,
      ConniToken: token,
    },
  };
};

export const mapDocumentoSt = (row = {}) => ({
  tipo_docto: txt(pick(row, ["tipo_docto", "TipoDoc", "Id_tipo_docto", "f350_id_tipo_docto"])) || "ST",
  consec_docto: txt(pick(row, ["consec_docto", "NumDoc", "Consec_docto", "f350_consec_docto"])),
  notas: txt(pick(row, ["notas", "Notas", "f350_notas"])),
  referencia_item: txt(pick(row, ["referencia_item", "Referencia", "referencia", "f120_referencia"])),
  descripcion_item: txt(pick(row, ["descripcion_item", "descripcion", "f120_descripcion"])),
  descripcion: txt(pick(row, ["descripcion", "descripcion_item", "f120_descripcion"])),
  descripcion_linea: txt(pick(row, ["descripcion_linea"])) || null,
  codigo_bodega_sal: txt(pick(row, ["codigo_bodega_sal", "bodega_sal_id"])),
  bodega_sal: txt(pick(row, ["bodega_sal", "desc_bodega_sal"])),
  codigo_bodega_ent: txt(pick(row, ["codigo_bodega_ent", "bodega_ent_id"])),
  bodega_ent: txt(pick(row, ["bodega_ent", "desc_bodega_ent"])),
  cant_salida: num(pick(row, ["cant_salida", "cant_saldo_1", "f470_cant_1"])),
  cant_saldo_1: num(pick(row, ["cant_saldo_1", "cant_salida", "f470_cant_1"])),
  cant_saldo_2: num(pick(row, ["cant_saldo_2", "f470_cant_2"])),
  estado_frio: txt(pick(row, ["estado_frio", "frio"])),
});

const isoFecha = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const diaSiguiente = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return isoFecha(new Date(y, m - 1, d + 1));
};

const rangoFechasSt = () => {
  const anio = new Date().getFullYear();
  const desde = txt(process.env.SIESA_ST_FECHA_DESDE) || `${anio}-01-01`;
  const hastaIncl = txt(process.env.SIESA_ST_FECHA_HASTA) || isoFecha(new Date());
  return { desde, hastaExcl: diaSiguiente(hastaIncl), hastaIncl };
};

const armarParametrosSt = () => {
  const { desde, hastaExcl } = rangoFechasSt();
  const custom = txt(process.env.SIESA_ST_PARAMETROS);
  if (custom) {
    return custom.replaceAll("{desde}", desde).replaceAll("{hasta}", hastaExcl);
  }
  return "";
};

const consultaNoManejaParametros = (texto) =>
  /no maneja parametros/i.test(texto || "") || /Must declare the scalar variable/i.test(texto || "");

const pedirPagina = async ({ pagina, pageSize, parametros }) => {
  const { baseUrl, idCompania, consulta, headers, key, token } = configSt();
  if (!key || !token) {
    throw new Error("Faltan SIESA_EXISTENCIAS_CONNI_KEY y SIESA_EXISTENCIAS_CONNI_TOKEN en el .env.");
  }
  const timeoutMs = Number(process.env.SIESA_ST_TIMEOUT_MS || 180000);
  const params = {
    idCompania,
    descripcion: consulta,
    paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
  };
  if (parametros) params.parametros = parametros;
  let response;
  try {
    response = await axios.get(baseUrl, {
      params,
      headers,
      timeout: timeoutMs,
    });
  } catch (error) {
    const payload = error.response?.data || {};
    const detalle = typeof payload.detalle === "string" ? payload.detalle : "";
    const texto = detalle || payload.mensaje || error.message || "";
    const wrapped = new Error(texto || "Connekta no devolvió ST.");
    wrapped.sinParametros = consultaNoManejaParametros(texto);
    throw wrapped;
  }
  const payload = response.data || {};
  if (payload.codigo && Number(payload.codigo) !== 0) {
    const detalle = typeof payload.detalle === "string" ? payload.detalle : "";
    const texto = payload.mensaje || detalle || "Connekta no devolvió ST.";
    const wrapped = new Error(texto);
    wrapped.sinParametros = consultaNoManejaParametros(`${payload.mensaje || ""} ${detalle || ""}`);
    throw wrapped;
  }
  return { filas: extraerFilas(payload), meta: metaPaginacion(payload) };
};

let cacheSt = { filas: [], at: 0, clave: "" };
let inflightSt = null;

const ttlCacheStMs = () => Number(process.env.SIESA_ST_CACHE_MS || 15 * 60 * 1000);

const claveRangoSt = () => {
  const { desde, hastaExcl } = rangoFechasSt();
  return `${desde}|${hastaExcl}`;
};

const bajarDocumentosSt = async () => {
  const { consulta } = configSt();
  const { desde, hastaExcl, hastaIncl } = rangoFechasSt();
  const pageSize = Number(process.env.SIESA_ST_TAM_PAG || 100);
  const maxPaginas = Number(process.env.SIESA_ST_MAX_PAGINAS || 80);
  const parametros = armarParametrosSt();
  const crudas = [];
  let totalPaginas = 1;
  console.log(`[st-siesa] ${consulta} ${parametros || "sin parametros"} ${desde}..${hastaIncl} tam=${pageSize}`);
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const lote = await pedirPagina({ pagina, pageSize, parametros });
    if (lote.meta.totalPaginas) totalPaginas = lote.meta.totalPaginas;
    crudas.push(...lote.filas);
    const parcial = crudas.map(mapDocumentoSt).filter((row) => row.consec_docto || row.referencia_item);
    cacheSt = { filas: parcial, at: Date.now(), clave: claveRangoSt() };
    console.log(`[st-siesa] pagina ${pagina}/${totalPaginas || "?"} acumulado ${parcial.length}`);
    if (!lote.filas.length || pagina >= totalPaginas || lote.filas.length < pageSize) break;
  }
  const mapped = crudas.map(mapDocumentoSt).filter((row) => row.consec_docto || row.referencia_item);
  console.log(
    `[st-siesa] ${consulta} ${parametros || "sin parametros"} ${desde}..${hastaIncl} (<${hastaExcl}): ${mapped.length} filas`
  );
  return mapped;
};

const refrescarStFondo = () => {
  if (inflightSt) return inflightSt;
  const clave = claveRangoSt();
  inflightSt = bajarDocumentosSt()
    .then((filas) => {
      cacheSt = { filas, at: Date.now(), clave };
      return filas;
    })
    .catch((error) => {
      console.error("ST Connekta:", error.message);
      return cacheSt.filas;
    })
    .finally(() => {
      inflightSt = null;
    });
  return inflightSt;
};

export const programarRefrescoSt = () => {
  const vigente =
    cacheSt.at > 0 &&
    Date.now() - cacheSt.at < ttlCacheStMs() &&
    cacheSt.clave === claveRangoSt();
  if (vigente || inflightSt) return;
  refrescarStFondo();
};

export const resumenSt = () => ({
  filas: cacheSt.filas,
  enCurso: Boolean(inflightSt),
  listo: cacheSt.filas.length > 0,
  at: cacheSt.at,
});

export const kpisTransito = (filas = []) => {
  let totalKgMovimiento = 0;
  let totalUnidadesMovimiento = 0;
  let canastasEnMovimiento = 0;
  let canastillasEnMovimiento = 0;
  for (const element of filas) {
    const referencia = txt(element.referencia_item);
    const cantidad = num(element.cant_saldo_1);
    const cantidadUnidades = num(element.cant_saldo_2);
    if (!referencia) continue;
    if (referencia === "CANASTAS") {
      canastasEnMovimiento += cantidad;
    } else if (referencia === "CANASTILLAS") {
      canastillasEnMovimiento += cantidad;
    } else {
      totalKgMovimiento += cantidad;
      totalUnidadesMovimiento += cantidadUnidades;
    }
  }
  return {
    totalKgMovimiento,
    totalUnidadesMovimiento,
    canastasEnMovimiento,
    canastillasEnMovimiento,
  };
};

export const agruparDocumentosSt = (filas = []) => {
  const porDocumento = {};
  for (const val of filas) {
    const consec = txt(val.consec_docto);
    if (!consec) continue;
    if (!porDocumento[consec]) {
      porDocumento[consec] = {
        consec_docto: val.consec_docto,
        tipo_docto: val.tipo_docto,
        codigo_bodega_sal: val.codigo_bodega_sal,
        bodega_sal: val.bodega_sal,
        codigo_bodega_ent: val.codigo_bodega_ent,
        bodega_ent: val.bodega_ent,
        notas: val.notas,
        detalles: [],
      };
    }
    porDocumento[consec].detalles.push({
      detallesConsec_dcto: {
        referencia_item: val.referencia_item,
        descripcion_item: val.descripcion_item,
        cant_salida: val.cant_salida,
        estado_frio: val.estado_frio,
        cant_saldo_2: val.cant_saldo_2,
      },
    });
  }
  return Object.values(porDocumento);
};

export const consultarDocumentosStSiesa = async (esperarMs = 0) => {
  programarRefrescoSt();
  if (cacheSt.filas.length || esperarMs <= 0) return cacheSt.filas;
  const limite = Date.now() + Number(esperarMs);
  while (!cacheSt.filas.length && inflightSt && Date.now() < limite) {
    await Promise.race([
      inflightSt,
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
  }
  return cacheSt.filas;
};

export default {
  consultarDocumentosStSiesa,
  programarRefrescoSt,
  mapDocumentoSt,
  resumenSt,
  kpisTransito,
  agruparDocumentosSt,
};
