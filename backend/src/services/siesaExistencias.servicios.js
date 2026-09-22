import axios from "axios";
import itemsModel from "../models/items.models";
import { BODEGAS_GRUPO_ETC, normalizarCodigoBodega, setBodegasCompania } from "../data/bodegasGrupoEtc";

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

const textoEmpaqueInventario = (row = {}) =>
  [
    row.descripcion,
    row.descripcion_item,
    row.referencia,
    row.referencia_item,
    row.tipo_inventario,
    row.desc_tipo_inventario,
  ]
    .map(txt)
    .join(" ")
    .toUpperCase();

export const esCanastillaInventario = (row = {}) =>
  /\bCANASTILLAS?\b/.test(textoEmpaqueInventario(row));

export const esCanastaInventario = (row = {}) => {
  if (esCanastillaInventario(row)) return true;
  const t = textoEmpaqueInventario(row);
  return /\bCANASTAS?\b/.test(t) || t.includes("INVCANASTA");
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
      "carnicosyalimentos_innova_inven_a_la_fecha_FV",
    usaParametros: /^(1|true|si)$/i.test(
      txt(process.env.SIESA_EXISTENCIAS_USA_PARAMETROS)
    ),
    plantillaParametros: txt(process.env.SIESA_EXISTENCIAS_PARAMETROS),
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
  return [...BODEGAS_GRUPO_ETC];
};

export const bodegasCompaniaUnicas = () => {
  const vistos = new Set();
  const lista = [];
  for (const codigo of bodegasCompania()) {
    const clave = normalizarCodigoBodega(codigo);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(codigo);
  }
  return lista;
};

export const esBodegaCompania = (codigo, permitidas) => {
  const set = permitidas || setBodegasCompania(bodegasCompania());
  return set.has(normalizarCodigoBodega(codigo));
};

export const esStInventarioCompania = (row = {}) =>
  esBodegaCompania(row.codigo_bodega_ent) || esBodegaCompania(row.codigo_bodega_sal);

export const mapExistencia = (row = {}) => {
  const un =
    txt(pick(row, ["UN", "unidad_medida_1", "f120_id_unidad_inventario", "um1", "unidad1"])) ||
    null;
  const cantidad = num(
    pick(row, [
      "Disponible",
      "disponible",
      "Existencia",
      "Existencia_1",
      "existencia_1",
      "f400_cant_existencia_1",
      "cant_existencia_1",
      "cantidad_1",
      "kilos",
      "kg",
    ])
  );
  const unidades = num(
    pick(row, [
      "Unidades",
      "UNIDADES",
      "Existencia_2",
      "existencia_2",
      "f400_cant_existencia_2",
      "cant_existencia_2",
      "cantidad_2",
      "Cantidad2",
      "cant_2",
      "ExistenciaUND",
      "existencia_und",
    ])
  );
  const esUnd = /^(und|unid)/i.test(un || "");
  const codigoBodega = txt(
    pick(row, ["IdBodega", "codigo_bodega", "f150_id", "id_bodega", "bodega"])
  );
  const desc = txt(
    pick(row, [
      "DescItem",
      "descripcion",
      "f120_descripcion",
      "desc_item",
      "descripcion_item",
    ])
  ).toUpperCase();
  const tipoInv = txt(
    pick(row, ["tipo_inventario", "id_tipo_inventario", "tipoinventario", "f121_id_ext1_detalle"])
  );
  const referencia = txt(
    pick(row, [
      "Referencia",
      "referencia",
      "f120_referencia",
      "f120_id",
      "codigo_item",
      "id_item",
      "item",
    ])
  );
  const esCanasta = esCanastaInventario({
    descripcion: desc,
    referencia,
    tipo_inventario: tipoInv,
  });
  const cantidadCanasta = esCanasta ? (unidades > 0 ? unidades : cantidad > 0 ? cantidad : 0) : 0;
  return {
  referencia,
  descripcion: txt(
    pick(row, [
      "DescItem",
      "descripcion",
      "f120_descripcion",
      "desc_item",
      "descripcion_item",
    ])
  ),
  id_item: txt(pick(row, ["IdItem", "id_item", "codigo_item", "f120_id"])),
  codigo_bodega: codigoBodega,
  descripcion_bodega: txt(
    pick(row, [
      "NomBodega",
      "descripcion_bodega",
      "f150_descripcion",
      "desc_bodega",
      "bodega_descripcion",
    ])
  ),
  unidad_medida_1: un,
  unidad_medida_2: txt(pick(row, ["unidad_medida_2", "f120_id_unidad_adicional", "um2", "unidad2"])) || null,
  Existencia_1: esCanasta || esUnd ? 0 : cantidad,
  Existencia_2: esCanasta ? 0 : unidades || (esUnd ? cantidad : 0),
  cantidad_canasta: cantidadCanasta,
  abc_rotacion_veces: pick(row, ["abc_rotacion_veces", "abc", "rotacion"]) || 0,
  tipo_inventario: tipoInv,
  desc_tipo_inventario: txt(pick(row, ["desc_tipo_inventario", "desctipoinventario"])) || "",
  id_linea: txt(pick(row, ["id_linea", "f120_id_linea"])) || null,
  descripcion_linea: txt(pick(row, ["descripcion_linea", "desc_linea", "linea_descripcion"])) || null,
  id_comb_criter: txt(pick(row, ["id_comb_criter", "id_combinacion"])) || null,
  descrip_comb_criter: txt(pick(row, ["descrip_comb_criter", "desc_combinacion", "combinacion_descripcion"])) || null,
  };
};

const partirCodigoNombre = (valor) => {
  const text = txt(valor);
  if (!text) return { id: "", nombre: "" };
  const corte = text.indexOf("-");
  if (corte < 0) return { id: text, nombre: text };
  const id = text.slice(0, corte).trim();
  const nombre = text.slice(corte + 1).trim();
  return { id: id || text, nombre: nombre || text };
};

const catalogoItemsInventario = async () => {
  const filas = await itemsModel
    .find(
      {},
      {
        referencia: 1,
        codigoItem: 1,
        item: 1,
        linea: 1,
        combinacion: 1,
        idTipoinventario: 1,
        descTipoInventario: 1,
        undInventario: 1,
        undAdicional: 1,
      }
    )
    .lean();
  const porClave = new Map();
  const registrar = (clave, item) => {
    const key = txt(clave).toUpperCase();
    if (key) porClave.set(key, item);
  };
  for (const item of filas) {
    registrar(item.referencia, item);
    registrar(item.codigoItem, item);
    registrar(item.item, item);
  }
  return porClave;
};

const enriquecerConItems = async (filas) => {
  if (!filas.length) return filas;
  const catalogo = await catalogoItemsInventario();
  let cruzadas = 0;
  const mapped = filas.map((row) => {
    const item =
      catalogo.get(txt(row.referencia).toUpperCase()) ||
      catalogo.get(txt(row.id_item).toUpperCase());
    if (!item) return row;
    cruzadas += 1;
    const linea = partirCodigoNombre(item.linea);
    const combinacion = partirCodigoNombre(item.combinacion);
    const etiqueta = (parte) =>
      parte.id && parte.nombre ? `${parte.id} - ${parte.nombre}` : parte.nombre || parte.id || "";
    return {
      ...row,
      referencia: txt(item.referencia) || row.referencia,
      tipo_inventario: row.tipo_inventario || txt(item.idTipoinventario),
      desc_tipo_inventario: row.desc_tipo_inventario || txt(item.descTipoInventario),
      unidad_medida_1: row.unidad_medida_1 || txt(item.undInventario) || null,
      unidad_medida_2: row.unidad_medida_2 || txt(item.undAdicional) || null,
      id_linea: row.id_linea || linea.id || null,
      descripcion_linea: row.descripcion_linea || etiqueta(linea) || null,
      id_comb_criter: row.id_comb_criter || combinacion.id || null,
      descrip_comb_criter: row.descrip_comb_criter || etiqueta(combinacion) || null,
    };
  });
  console.log(
    `[existencias-siesa] items locales: ${cruzadas}/${filas.length} filas con línea/combinación`
  );
  return mapped;
};

const armarParametros = (bodega, tipoInventario, plantilla) => {
  const plantillaParametros = plantilla ?? configExistencias().plantillaParametros;
  if (!plantillaParametros) return "";
  return plantillaParametros
    .replace(/\{bodega\}/gi, txt(bodega))
    .replace(/\{tipoinventario\}/gi, txt(tipoInventario));
};

const CACHE_MS = Number(process.env.SIESA_EXISTENCIAS_CACHE_MS || 120000);
let cacheInventario = { at: 0, mapped: null, promise: null };

/** SQL: backend/src/services/siesaExistencias.consulta.sql (pegar en Connekta). */
const consultaPorBodega = () =>
  txt(process.env.SIESA_CONSULTA_EXISTENCIAS_BODEGA) ||
  txt(process.env.SIESA_CONSULTA_EXISTENCIAS_UNIDADES) ||
  "carnicosyalimentos_existencias_por_bodega";

const pedirPagina = async ({
  bodega,
  tipoInventario,
  pagina,
  pageSize,
  consulta,
  parametros,
} = {}) => {
  const cfg = configExistencias();
  if (!cfg.key || !cfg.token) {
    throw new Error(
      "Faltan SIESA_EXISTENCIAS_CONNI_KEY y SIESA_EXISTENCIAS_CONNI_TOKEN en el .env."
    );
  }
  const timeoutMs = Number(process.env.SIESA_EXISTENCIAS_TIMEOUT_MS || 60000);
  const params = {
    idCompania: cfg.idCompania,
    descripcion: consulta || cfg.consulta,
    paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
  };
  const paramsTxt =
    parametros != null
      ? parametros
      : cfg.usaParametros
        ? armarParametros(bodega, tipoInventario)
        : "";
  if (paramsTxt) params.parametros = paramsTxt;
  let response;
  try {
    response = await axios.get(cfg.baseUrl, {
      params,
      headers: cfg.headers,
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

const mapPool = async (items, limit, fn) => {
  const out = new Array(items.length);
  let indice = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) || 0 }, async () => {
    while (indice < items.length) {
      const actual = indice;
      indice += 1;
      out[actual] = await fn(items[actual]);
    }
  });
  await Promise.all(workers);
  return out;
};

const descargarExistenciasPorBodega = async (bodega) => {
  const codigo = txt(bodega);
  if (!codigo) return [];
  const consulta = consultaPorBodega();
  const pageSize = Number(process.env.SIESA_EXISTENCIAS_TAM_PAG || 100);
  const maxPaginas = Number(process.env.SIESA_EXISTENCIAS_MAX_PAGINAS || 80);
  const parametros = `bodega = ${codigo}|tipoinventario = `;
  const filas = [];
  let totalPaginas = 1;
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const lote = await pedirPagina({
      pagina,
      pageSize,
      consulta,
      parametros,
    });
    if (lote.meta.totalPaginas) totalPaginas = lote.meta.totalPaginas;
    filas.push(...lote.filas);
    if (!lote.filas.length || pagina >= totalPaginas || lote.filas.length < pageSize) break;
  }
  const mapped = filas
    .map(mapExistencia)
    .filter((row) => row.referencia || row.descripcion)
    .filter(
      (row) =>
        num(row.Existencia_1) > 0 ||
        num(row.Existencia_2) > 0 ||
        num(row.cantidad_canasta) > 0
    );
  const kg = mapped.reduce((acc, row) => acc + kgInventarioFila(row), 0);
  const und = mapped.reduce((acc, row) => acc + unidadesInventarioFila(row), 0);
  const empaque = totalCanastasEtc(mapped);
  console.log(
    `[existencias-siesa] ${consulta} ${codigo}: ${mapped.length} filas kg=${kg.toFixed(1)} und=${und.toFixed(0)} canastas=${empaque.canastas} canastillas=${empaque.canastillas}`
  );
  return mapped;
};

const descargarInventarioFecha = async () => {
  const codigos = bodegasCompaniaUnicas();
  console.log(`[existencias-siesa] ETC por bodega (${codigos.length}): ${codigos.join(", ")}`);
  const lotes = await mapPool(codigos, 3, async (codigo) => {
    try {
      return await descargarExistenciasPorBodega(codigo);
    } catch (error) {
      console.error(`[existencias-siesa] ${codigo}:`, error.message);
      return [];
    }
  });
  return enriquecerConItems(lotes.flat());
};

const inventarioFecha = async () => {
  if (cacheInventario.mapped && Date.now() - cacheInventario.at < CACHE_MS) {
    return cacheInventario.mapped;
  }
  if (cacheInventario.promise) return cacheInventario.promise;
  cacheInventario.promise = descargarInventarioFecha()
    .then((mapped) => {
      cacheInventario.mapped = mapped;
      cacheInventario.at = Date.now();
      cacheInventario.promise = null;
      return mapped;
    })
    .catch((error) => {
      cacheInventario.promise = null;
      throw error;
    });
  return cacheInventario.promise;
};

export const cantidadCanastaFila = (row = {}) => {
  if (!esCanastaInventario(row)) return 0;
  const dedicada = num(row.cantidad_canasta);
  if (dedicada > 0) return dedicada;
  const unidades = num(row.Existencia_2);
  if (unidades > 0) return unidades;
  const kg = num(row.Existencia_1);
  return kg > 0 ? kg : 0;
};

export const kgInventarioFila = (row = {}) => {
  if (esCanastaInventario(row)) return 0;
  const kg = num(row.Existencia_1);
  return kg > 0 ? kg : 0;
};

export const unidadesInventarioFila = (row = {}) => {
  if (esCanastaInventario(row)) return 0;
  const un = txt(row.unidad_medida_1);
  if (/^(und|unid)/i.test(un)) return 0;
  const und = num(row.Existencia_2);
  return und > 0 ? und : 0;
};

export const totalKgEtc = (filas = []) =>
  filas.reduce((acc, row) => acc + kgInventarioFila(row), 0);

export const totalUnidadesEtc = (filas = []) =>
  filas.reduce((acc, row) => acc + unidadesInventarioFila(row), 0);

export const totalCanastasEtc = (filas = []) =>
  filas.reduce(
    (acc, row) => {
      const cant = cantidadCanastaFila(row);
      if (!(cant > 0)) return acc;
      if (esCanastillaInventario(row)) acc.canastillas += cant;
      else acc.canastas += cant;
      return acc;
    },
    { canastas: 0, canastillas: 0 }
  );

export const consultarExistenciasPorBodega = async (bodega, { log = true } = {}) => {
  const codigo = txt(bodega);
  if (!codigo) return [];
  const mapped = await inventarioFecha();
  const filas = mapped.filter(
    (row) => normalizarCodigoBodega(row.codigo_bodega) === normalizarCodigoBodega(codigo)
  );
  if (log) {
    console.log(`[existencias-siesa] bodega ${codigo}: ${filas.length} filas`);
  }
  return filas;
};

export const consultarExistenciasCompania = async (codigos) => {
  const mapped = await inventarioFecha();
  const lista = (codigos && codigos.length ? codigos : bodegasCompaniaUnicas())
    .map(normalizarCodigoBodega)
    .filter(Boolean);
  const permitidas = setBodegasCompania(lista);
  const filas = mapped.filter((row) => permitidas.has(normalizarCodigoBodega(row.codigo_bodega)));
  const porBodega = {};
  for (const row of filas) {
    const codigo = txt(row.codigo_bodega) || "(vacio)";
    if (!porBodega[codigo]) porBodega[codigo] = { filas: 0, kg: 0, und: 0 };
    porBodega[codigo].filas += 1;
    porBodega[codigo].kg += kgInventarioFila(row);
    porBodega[codigo].und += unidadesInventarioFila(row);
  }
  console.log(
    `[existencias-siesa] ETC por bodega compañia: ${filas.length}/${mapped.length} filas (${lista.length} bodegas)`,
    porBodega
  );
  return filas;
};

export const listarBodegasInventario = async () => {
  const mapped = await inventarioFecha();
  const porCodigo = new Map();
  for (const row of mapped) {
    const codigo = txt(row.codigo_bodega);
    if (!codigo || porCodigo.has(codigo)) continue;
    porCodigo.set(codigo, {
      codigo,
      descripcion: txt(row.descripcion_bodega) || codigo,
    });
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
};

export default {
  consultarExistenciasPorBodega,
  consultarExistenciasCompania,
  listarBodegasInventario,
  mapExistencia,
  fuenteExistenciasCem,
  bodegasCompania,
  bodegasCompaniaUnicas,
  esBodegaCompania,
  esStInventarioCompania,
  esCanastaInventario,
  esCanastillaInventario,
  cantidadCanastaFila,
  kgInventarioFila,
  unidadesInventarioFila,
  totalKgEtc,
  totalUnidadesEtc,
  totalCanastasEtc,
};
