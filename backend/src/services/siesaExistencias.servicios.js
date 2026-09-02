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

const extraerQuery = (raw) => {
  const url = txt(raw);
  const corte = url.indexOf("?");
  if (corte < 0) return {};
  try {
    return Object.fromEntries(new URL(url).searchParams.entries());
  } catch {
    return {};
  }
};

const normalizarBaseUrl = (raw) => {
  const url = txt(raw);
  if (!url) return "https://servicios.siesacloud.com/api/connekta/v3/ejecutarconsulta";
  const corte = url.indexOf("?");
  return corte < 0 ? url : url.slice(0, corte);
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
    totalRegistros: Number(detalle.total_registros || 0),
  };
};

const tiposDesdeEnv = () => {
  const crudo = txt(process.env.SIESA_EXISTENCIAS_TIPOS);
  if (!crudo || crudo === "*") return [""];
  return crudo
    .split(",")
    .map((tipo) => tipo.trim())
    .filter(Boolean);
};

const configExistencias = () => {
  const key = txt(process.env.SIESA_EXISTENCIAS_CONNI_KEY);
  const token = txt(process.env.SIESA_EXISTENCIAS_CONNI_TOKEN);
  const rawUrl =
    process.env.SIESA_EXISTENCIAS_BASE_URL ||
    "https://servicios.siesacloud.com/api/connekta/v3/ejecutarconsulta";
  const query = extraerQuery(rawUrl);
  return {
    baseUrl: normalizarBaseUrl(rawUrl),
    idCompania:
      process.env.SIESA_EXISTENCIAS_ID_COMPANIA ||
      query.idCompania ||
      process.env.SIESA_ID_COMPANIA ||
      "55",
    consulta:
      process.env.SIESA_CONSULTA_EXISTENCIAS ||
      query.descripcion ||
      "carnicosyalimentos_existencias_por_bodega",
    plantillaParametros:
      process.env.SIESA_EXISTENCIAS_PARAMETROS ||
      "bodega = {bodega}|tipoinventario = {tipoinventario}",
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

export const fuenteExistenciasCem = () => {
  const valor = txt(process.env.INVENTARIO_EXISTENCIAS_FUENTE).toLowerCase();
  return valor === "cem" || valor === "5015";
};

export const bodegasCompania = () => {
  const crudo = txt(process.env.SIESA_EXISTENCIAS_BODEGAS_CIA);
  if (crudo) {
    return crudo.split(",").map((codigo) => codigo.trim()).filter(Boolean);
  }
  return [
    "002",
    "PT001",
    "PT003",
    "PT002",
    "001",
    "BM004",
    "008",
    "PT004",
    "PT0PV",
    "009",
    "BM002",
    "BM001",
    "011",
    "BM003",
    "PT006",
  ];
};

const mapPool = async (items, limit, fn) => {
  const out = [];
  let indice = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    while (indice < items.length) {
      const actual = indice;
      indice += 1;
      out[actual] = await fn(items[actual]);
    }
  });
  await Promise.all(workers);
  return out;
};

export const mapExistencia = (row = {}) => ({
  referencia: txt(
    pick(row, ["referencia", "f120_referencia", "f120_id", "codigo_item", "id_item", "item"])
  ),
  descripcion: txt(pick(row, ["descripcion", "f120_descripcion", "desc_item", "descripcion_item"])),
  codigo_bodega: txt(pick(row, ["codigo_bodega", "f150_id", "id_bodega", "bodega"])),
  descripcion_bodega: txt(
    pick(row, ["descripcion_bodega", "f150_descripcion", "desc_bodega", "bodega_descripcion"])
  ),
  unidad_medida_1: txt(pick(row, ["unidad_medida_1", "f120_id_unidad_inventario", "um1", "unidad1"])) || null,
  unidad_medida_2: txt(pick(row, ["unidad_medida_2", "f120_id_unidad_adicional", "um2", "unidad2"])) || null,
  Existencia_1: num(
    pick(row, [
      "Existencia_1",
      "existencia_1",
      "f400_cant_existencia_1",
      "cant_existencia_1",
      "cantidad_1",
      "kilos",
      "kg",
    ])
  ),
  Existencia_2: num(
    pick(row, [
      "Existencia_2",
      "existencia_2",
      "f400_cant_existencia_2",
      "cant_existencia_2",
      "cantidad_2",
      "unidades",
    ])
  ),
  abc_rotacion_veces: pick(row, ["abc_rotacion_veces", "abc", "rotacion"]) || 0,
  tipo_inventario: txt(
    pick(row, ["tipo_inventario", "id_tipo_inventario", "tipoinventario", "f121_id_ext1_detalle"])
  ),
  id_linea: txt(pick(row, ["id_linea", "f120_id_linea", "linea"])) || null,
  descripcion_linea: txt(pick(row, ["descripcion_linea", "desc_linea", "linea_descripcion"])) || null,
  id_comb_criter: txt(pick(row, ["id_comb_criter", "combinacion", "id_combinacion"])) || null,
  descrip_comb_criter: txt(pick(row, ["descrip_comb_criter", "desc_combinacion", "combinacion_descripcion"])) || null,
});

const armarParametros = (bodega, tipoInventario) => {
  const { plantillaParametros } = configExistencias();
  return plantillaParametros
    .replace(/\{bodega\}/gi, txt(bodega))
    .replace(/\{tipoinventario\}/gi, txt(tipoInventario));
};

const pedirPagina = async ({ bodega, tipoInventario, pagina, pageSize }) => {
  const { baseUrl, idCompania, consulta, headers, key, token } = configExistencias();
  if (!key || !token) {
    throw new Error(
      "Faltan SIESA_EXISTENCIAS_CONNI_KEY y SIESA_EXISTENCIAS_CONNI_TOKEN en el .env."
    );
  }
  const timeoutMs = Number(process.env.SIESA_EXISTENCIAS_TIMEOUT_MS || 60000);
  let response;
  try {
    response = await axios.get(baseUrl, {
      params: {
        idCompania,
        descripcion: consulta,
        paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
        parametros: armarParametros(bodega, tipoInventario),
      },
      headers,
      timeout: timeoutMs,
    });
  } catch (error) {
    const payload = error.response?.data || {};
    const detalle = typeof payload.detalle === "string" ? payload.detalle : "";
    throw new Error(
      detalle || payload.mensaje || error.message || "Connekta no devolvió existencias."
    );
  }
  const payload = response.data || {};
  if (payload.codigo && Number(payload.codigo) !== 0) {
    const detalle = typeof payload.detalle === "string" ? payload.detalle : "";
    throw new Error(payload.mensaje || detalle || "Connekta no devolvió existencias.");
  }
  return { filas: extraerFilas(payload), meta: metaPaginacion(payload) };
};

const consultarTipo = async (bodega, tipoInventario) => {
  const pageSize = Number(process.env.SIESA_EXISTENCIAS_TAM_PAG || 100);
  const maxPaginas = Number(process.env.SIESA_EXISTENCIAS_MAX_PAGINAS || 50);
  const filas = [];
  let totalPaginas = 1;
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const { filas: page, meta } = await pedirPagina({ bodega, tipoInventario, pagina, pageSize });
    if (meta.totalPaginas) totalPaginas = meta.totalPaginas;
    filas.push(...page);
    if (!page.length || pagina >= totalPaginas || page.length < pageSize) break;
  }
  return filas;
};

export const consultarExistenciasPorBodega = async (bodega, { log = true } = {}) => {
  const codigo = txt(bodega);
  if (!codigo) return [];
  const { consulta } = configExistencias();
  const tipos = tiposDesdeEnv();
  const lotes = await Promise.all(tipos.map((tipo) => consultarTipo(codigo, tipo)));
  const crudas = lotes.flat();
  if (log && crudas[0] && typeof crudas[0] === "object") {
    console.log(`[existencias-siesa] ${consulta} ${codigo} columnas: ${Object.keys(crudas[0]).join(", ")}`);
  }
  const mapped = crudas.map(mapExistencia).filter((row) => row.referencia || row.descripcion);
  if (log) console.log(`[existencias-siesa] ${consulta} ${codigo}: ${mapped.length} filas`);
  return mapped;
};

export const consultarExistenciasCompania = async (codigos = bodegasCompania()) => {
  const lista = (codigos || []).map((codigo) => txt(codigo)).filter(Boolean);
  const limit = Number(process.env.SIESA_EXISTENCIAS_CONCURRENCIA || 3);
  const lotes = await mapPool(lista, limit, (codigo) =>
    consultarExistenciasPorBodega(codigo, { log: false })
  );
  const filas = lotes.flat();
  console.log(`[existencias-siesa] compania ${lista.length} bodegas: ${filas.length} filas`);
  return filas;
};

export default {
  consultarExistenciasPorBodega,
  consultarExistenciasCompania,
  mapExistencia,
  fuenteExistenciasCem,
  bodegasCompania,
};
