import axios from "axios";

const txt = (valor) => String(valor ?? "").trim();

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
  if (!url) return "https://serviciosqa.siesacloud.com/api/connekta/v3.1/ejecutarconsulta";
  const corte = url.indexOf("?");
  return corte < 0 ? url : url.slice(0, corte);
};

const configBodegas = () => {
  const key = process.env.SIESA_PEDIDOS_CONNI_KEY || process.env.SIESA_CONNI_KEY || "";
  const token = process.env.SIESA_PEDIDOS_CONNI_TOKEN || process.env.SIESA_CONNI_TOKEN || "";
  const rawUrl =
    process.env.SIESA_BODEGAS_BASE_URL ||
    process.env.SIESA_PEDIDOS_BASE_URL ||
    "https://serviciosqa.siesacloud.com/api/connekta/v3.1/ejecutarconsulta";
  const query = extraerQuery(rawUrl);
  return {
    baseUrl: normalizarBaseUrl(rawUrl),
    idCompania:
      process.env.SIESA_PEDIDOS_ID_COMPANIA ||
      query.idCompania ||
      process.env.SIESA_ID_COMPANIA ||
      "55",
    consulta: process.env.SIESA_CONSULTA_BODEGAS || query.descripcion || "carnicosyalimentos_Bodegas",
    idCiaUnoee: Number(process.env.SIESA_ID_CIA || 13),
    headers: {
      "Content-Type": "application/json",
      ConnKey: key,
      ConnToken: token,
      ConniKey: key,
      ConniToken: token,
    },
  };
};

const mapBodega = (row = {}) => ({
  codigo: txt(row.f150_id),
  descripcion: txt(row.f150_descripcion || row.f150_descripcion_corta),
  idCia: Number(row.f150_id_cia) || 0,
  estado: Number(row.f150_ind_estado),
  co: txt(row.f150_id_co),
});

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
    if (Array.isArray(candidato)) return candidato;
  }
  return [];
};

const metaPaginacion = (payload) => {
  const detalle = payload?.detalle || {};
  const num = (valor) => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    pagina: num(detalle.página_actual || detalle.pagina_actual || detalle.pagina),
    totalPaginas: num(detalle.total_páginas || detalle.total_paginas),
    totalRegistros: num(detalle.total_registros),
  };
};

const pedirPagina = async ({ pagina, pageSize = 100 } = {}) => {
  const { baseUrl, idCompania, consulta, headers } = configBodegas();
  const timeoutMs = Number(process.env.SIESA_BODEGAS_TIMEOUT_MS || 60000);
  const response = await axios.get(baseUrl, {
    params: {
      idCompania,
      descripcion: consulta,
      paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
    },
    headers,
    timeout: timeoutMs,
  });
  const payload = response.data || {};
  if (payload.codigo && Number(payload.codigo) !== 0) {
    throw new Error(payload.mensaje || payload.detalle || "Connekta no devolvió bodegas.");
  }
  return { filas: extraerFilas(payload), meta: metaPaginacion(payload) };
};

export const consultarBodegasSiesa = async () => {
  const { idCiaUnoee, consulta } = configBodegas();
  const pageSize = Number(process.env.SIESA_BODEGAS_TAM_PAG || 100);
  const maxPaginas = Number(process.env.SIESA_BODEGAS_MAX_PAGINAS || 20);
  const filas = [];
  let totalPaginas = 1;
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const { filas: page, meta } = await pedirPagina({ pagina, pageSize });
    filas.push(...page);
    if (meta.totalPaginas) totalPaginas = meta.totalPaginas;
    if (!page.length || pagina >= totalPaginas || page.length < pageSize) break;
  }
  const porCodigo = new Map();
  let sinCodigo = 0;
  let otraCia = 0;
  let inactivas = 0;
  for (const row of filas) {
    const mapped = mapBodega(row);
    if (!mapped.codigo) {
      sinCodigo += 1;
      continue;
    }
    if (mapped.idCia !== idCiaUnoee) {
      otraCia += 1;
      continue;
    }
    if (mapped.estado !== 1) {
      inactivas += 1;
      continue;
    }
    if (!porCodigo.has(mapped.codigo)) porCodigo.set(mapped.codigo, mapped);
  }
  const bodegas = [...porCodigo.values()]
    .map(({ codigo, descripcion, co }) => ({
      codigo,
      descripcion: descripcion || codigo,
      co,
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
  console.log(
    `[bodegas-siesa] ${consulta} cia ${idCiaUnoee}: ${bodegas.length} activas (filas ${filas.length}, otra cia ${otraCia}, inactivas ${inactivas}, sin código ${sinCodigo})`
  );
  return bodegas;
};

export const sincronizarCatalogoBodegas = async (bodegaModel) => {
  const siesa = await consultarBodegasSiesa();
  if (!siesa.length) return { sincronizadas: 0 };
  const ops = siesa.map((bodega) => ({
    updateOne: {
      filter: { codigo: bodega.codigo },
      update: {
        $set: {
          nombre: bodega.descripcion,
          estado: 0,
          fecha_actualizacion: new Date(),
        },
        $setOnInsert: {
          ubicacion: bodega.co ? `CO ${bodega.co}` : "SIESA",
          muellesDespacho: 1,
          fecha_creacion: new Date(),
        },
      },
      upsert: true,
    },
  }));
  try {
    await bodegaModel.bulkWrite(ops, { ordered: false });
  } catch (error) {
    console.error("Sync bodegas SIESA bulkWrite:", error.message);
    throw error;
  }
  return { sincronizadas: siesa.length };
};

export default { consultarBodegasSiesa, sincronizarCatalogoBodegas };
