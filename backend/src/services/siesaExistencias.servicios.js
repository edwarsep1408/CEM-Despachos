import axios from "axios";
import itemsModel from "../models/items.models";

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

export const mapExistencia = (row = {}) => {
  const un =
    txt(pick(row, ["UN", "unidad_medida_1", "f120_id_unidad_inventario", "um1", "unidad1"])) ||
    null;
  const cantidad = num(
    pick(row, [
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
  return {
  referencia: txt(
    pick(row, [
      "Referencia",
      "referencia",
      "f120_referencia",
      "f120_id",
      "codigo_item",
      "id_item",
      "item",
    ])
  ),
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
  codigo_bodega: txt(
    pick(row, ["IdBodega", "codigo_bodega", "f150_id", "id_bodega", "bodega"])
  ),
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
  Existencia_1: unidades ? (esUnd ? 0 : cantidad) : esUnd ? 0 : cantidad,
  Existencia_2: unidades || (esUnd ? cantidad : 0),
  abc_rotacion_veces: pick(row, ["abc_rotacion_veces", "abc", "rotacion"]) || 0,
  tipo_inventario: txt(
    pick(row, ["tipo_inventario", "id_tipo_inventario", "tipoinventario", "f121_id_ext1_detalle"])
  ),
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

const pedirPagina = async ({ bodega, tipoInventario, pagina, pageSize }) => {
  const cfg = configExistencias();
  if (!cfg.key || !cfg.token) {
    throw new Error(
      "Faltan SIESA_EXISTENCIAS_CONNI_KEY y SIESA_EXISTENCIAS_CONNI_TOKEN en el .env."
    );
  }
  const timeoutMs = Number(process.env.SIESA_EXISTENCIAS_TIMEOUT_MS || 60000);
  const params = {
    idCompania: cfg.idCompania,
    descripcion: cfg.consulta,
    paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
  };
  if (cfg.usaParametros) {
    params.parametros = armarParametros(bodega, tipoInventario);
  }
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

const descargarInventarioFecha = async () => {
  const { consulta } = configExistencias();
  const pageSize = Number(process.env.SIESA_EXISTENCIAS_TAM_PAG || 100);
  const maxPaginas = Number(process.env.SIESA_EXISTENCIAS_MAX_PAGINAS || 80);
  const filas = [];
  let totalPaginas = 1;
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const { filas: page, meta } = await pedirPagina({ pagina, pageSize });
    if (meta.totalPaginas) totalPaginas = meta.totalPaginas;
    filas.push(...page);
    if (!page.length || pagina >= totalPaginas || page.length < pageSize) break;
  }
  if (filas[0] && typeof filas[0] === "object") {
    console.log(
      `[existencias-siesa] ${consulta} columnas: ${Object.keys(filas[0]).join(", ")}`
    );
  }
  const mapped = await enriquecerConItems(
    filas.map(mapExistencia).filter((row) => row.referencia || row.descripcion)
  );
  console.log(`[existencias-siesa] ${consulta}: ${mapped.length} filas`);
  return mapped;
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

export const consultarExistenciasPorBodega = async (bodega, { log = true } = {}) => {
  const codigo = txt(bodega);
  if (!codigo) return [];
  const mapped = await inventarioFecha();
  const filas = mapped.filter(
    (row) => txt(row.codigo_bodega).toUpperCase() === codigo.toUpperCase()
  );
  if (log) {
    console.log(`[existencias-siesa] bodega ${codigo}: ${filas.length} filas`);
  }
  return filas;
};

export const consultarExistenciasCompania = async (codigos) => {
  const mapped = await inventarioFecha();
  const lista = (codigos || []).map((codigo) => txt(codigo).toUpperCase()).filter(Boolean);
  const filas = lista.length
    ? mapped.filter((row) => lista.includes(txt(row.codigo_bodega).toUpperCase()))
    : mapped;
  const { consulta } = configExistencias();
  console.log(`[existencias-siesa] ${consulta} compania: ${filas.length} filas`);
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
};
