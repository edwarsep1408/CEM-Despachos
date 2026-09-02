import axios from "axios";
import pedidosModel from "../models/pedidos.models";
import siesaEtlLineas from "../models/siesaEtlLineas.models";

let etlAbortController = new AbortController();

export const resetEtlAbort = () => {
  etlAbortController = new AbortController();
};

export const abortEtlPedidos = () => {
  etlAbortController.abort();
};

export const etlEstaCancelado = () =>
  Boolean(etlAbortController?.signal?.aborted);

export const errorEtlCancelado = () => {
  const err = new Error("Sincronización cancelada.");
  err.status = 499;
  err.cancelado = true;
  return err;
};

export const asegurarNoCancelado = () => {
  if (etlEstaCancelado()) throw errorEtlCancelado();
};

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

const pickCo = (row) =>
  String(pick(row, ["COPedido", "Id_co", "f430_id_co", "id_co_movto", "co"]) || "").trim();

const pickBodegaCruda = (row) =>
  String(
    pick(row, [
      "Id_bodega",
      "id_bodega",
      "BODEGA",
      "f431_id_bodega",
      "f150_id",
      "f460_id_bodega",
    ]) || ""
  ).trim();

const bodegaDistintaDeCo = (bodega, co) => {
  const b = String(bodega || "").trim();
  const c = String(co || "").trim();
  if (!b || (c && b === c)) return "";
  return b;
};

const resolverBodegaPedido = (pedido = {}, lineas = []) => {
  const co = String(pedido.co || lineas[0]?.co || "").trim();
  const bodega =
    bodegaDistintaDeCo(lineas[0]?.bodega, co) ||
    bodegaDistintaDeCo(pedido.bodega, co) ||
    "";
  return { co, bodega };
};

const ESTADOS_PEDIDO = {
  0: "Elaborado",
  1: "Retenido",
  2: "Aprobado",
  3: "Anulado",
  4: "Cumplido",
};

const etiquetaEstado = (row) => {
  const crudo = pick(row, [
    "Ind_estado_pv",
    "f430_ind_estado",
    "Ind_estado_linea",
    "f431_ind_estado",
  ]);
  if (crudo === "" || crudo === null || crudo === undefined) return "";
  const clave = String(crudo).trim();
  if (/[A-Za-z]/.test(clave)) return clave;
  return ESTADOS_PEDIDO[clave] || ESTADOS_PEDIDO[Number(clave)] || clave;
};

const fechaDocumentoDeFila = (row) =>
  String(
    pick(row, [
      "FechaPedido",
      "Fecha",
      "Id_fecha",
      "ID_FECHA",
      "FECHA",
      "fecha",
      "f430_id_fecha",
      "f460_id_fecha",
      "f350_fecha",
      "f461_id_fecha",
    ]) || ""
  )
    .trim()
    .slice(0, 10);

const fechaHoraDeFila = (row) => {
  const fecha = fechaDocumentoDeFila(row);
  const horaPick = String(pick(row, ["HORA", "hora"]) || "").trim();
  const tsHora = String(
    pick(row, [
      "FechaSync",
      "FechaActualizacion",
      "f430_ts",
      "Fecha_ts_creacion",
      "fecha_ts_creacion",
      "FechaPedido",
      "Fecha",
      "f430_id_fecha",
    ]) || ""
  ).trim();
  const horaTs = (tsHora.match(/T(\d{2}:\d{2}:\d{2})/) || [])[1] || "";
  const hora = horaPick || horaTs;
  return { fecha, hora: hora === "00:00:00" ? "" : hora };
};

const mapCabecera = (row) => {
  const tipoDocto = String(
    pick(row, [
      "Id_tipo_docto",
      "TipoDocPedido",
      "TipoDoc",
      "id_tipo_docto",
      "tipo_docto",
      "TIPO",
      "tipo",
      "f350_id_tipo_docto",
      "f430_id_tipo_docto",
      "f430_tipo_docto",
    ]) || ""
  ).trim();
  const consec = String(
    pick(row, [
      "Consec_docto",
      "NumPedido",
      "NumDoc",
      "ID_ENC",
      "id_enc",
      "idEnc",
      "f430_consec_docto",
      "f350_consec_docto",
    ]) || ""
  ).trim();
  const nitBase = String(
    pick(row, [
      "NIT",
      "Nit",
      "nit",
      "id_pedido_fact",
      "f200_nit",
      "f200_nit_fact",
      "f350_id_tercero",
      "id_tercero",
      "nit_cliente",
    ]) || ""
  ).trim();
  const sucursal = String(
    pick(row, [
      "SUCURSAL",
      "Sucursal",
      "sucursal",
      "Id_sucursal_fact",
      "Id_sucursal_rem",
      "f430_id_sucursal_fact",
      "f461_id_sucursal_fact",
      "f460_id_sucursal_fact",
      "id_sucursal",
    ]) || ""
  ).trim();
  const { fecha, hora } = fechaHoraDeFila(row);
  const nit =
    nitBase && sucursal && !nitBase.includes("-")
      ? `${nitBase}-${sucursal}`
      : nitBase;

  return {
    idEnc: consec,
    tipoDocto,
    nit,
    sucursal,
    sucursalDescripcion: pick(row, [
      "descripcion_sucursal",
      "Desc_sucursal",
      "nombre_sucursal",
      "f201_descripcion_sucursal",
      "f201_descripcion",
    ]),
    cliente: pick(row, [
      "CLIENTE",
      "cliente",
      "razon_social",
      "RazonSocial",
      "f200_razon_social",
      "f200_razon_social_fact",
      "nombre_tercero",
      "nombre_cliente",
    ]),
    establecimiento: pick(row, [
      "NombreEstablecimiento",
      "ESTABLECIMIENTO",
      "establecimiento",
      "f200_nombre_est",
    ]),
    estado: etiquetaEstado(row),
    barrio: pick(row, ["BARRIO", "barrio"]),
    municipio: pick(row, ["MUNICIPIO", "municipio", "ciudad"]),
    direccion: pick(row, ["DIRECCION", "direccion", "dir"]),
    telefono: pick(row, ["TELEFONO", "telefono", "tel"]),
    observacion: pick(row, [
      "notas_pedido",
      "f430_notas",
      "f430_referencia",
      "f430_num_docto_referencia",
      "DocReferencia",
      "Referencia",
      "notas",
      "Notas",
      "OBSERVACION",
      "observacion",
      "notas_linea",
      "f431_notas",
    ]),
    co: pickCo(row),
    bodega: bodegaDistintaDeCo(pickBodegaCruda(row), pickCo(row)),
    fechaEntrega: String(
      pick(row, ["Fecha_entrega", "fecha_entrega", "f430_fecha_entrega", "f431_fecha_entrega"]) || ""
    ).slice(0, 10),
    codigo: pick(row, [
      "Vendedor",
      "VENDEDOR",
      "COD_VENDEDOR",
      "f210_id",
      "CODIGO",
      "codigo",
      "codigo_ruta",
    ]),
    fecha,
    hora,
    valor: pick(row, [
      "vlr_neto",
      "vlr_bruto",
      "VALOR",
      "valor",
      "valor_total",
      "Valor_total",
      "Total",
      "total",
      "f350_valor",
      "f350_total",
    ]),
    cp: pick(row, ["CP", "cp"]),
    enRuta: pick(row, ["ENRUTA", "enruta", "en_ruta", "enRuta"]),
    vendedor:
      String(
        pick(row, [
          "Desc_vendedor",
          "f210_descripcion",
          "descripcion_vendedor",
          "NombreVendedor",
          "nombre_vendedor",
        ]) || ""
      ).trim() ||
      String(pick(row, ["Vendedor", "VENDEDOR", "vendedor", "f210_id"]) || "").trim(),
    contacto: pick(row, ["CONTACTO", "contacto", "descripcion_sucursal"]),
  };
};

const normalizarNit = (valor) => {
  let s = String(valor || "").trim().replace(/[.\s]/g, "");
  if (s.includes("-")) s = s.split("-")[0];
  return s;
};

const nitDePedido = (row) =>
  normalizarNit(
    pick(row, [
      "id_pedido_fact",
      "NIT",
      "nit",
      "f200_nit",
      "f200_nit_fact",
      "f350_id_tercero",
      "id_tercero",
      "nit_cliente",
    ])
  );

const sucursalDePedido = (row) =>
  String(
    pick(row, [
      "Id_sucursal_fact",
      "Id_sucursal_rem",
      "SUCURSAL",
      "sucursal",
      "f430_id_sucursal_fact",
      "f460_id_sucursal_fact",
      "f461_id_sucursal_fact",
      "id_sucursal",
    ]) || ""
  ).trim();

const nitDeCliente = (row) =>
  normalizarNit(
    pick(row, [
      "Nit",
      "f200_id",
      "f200_nit",
      "NIT",
      "nit",
      "Id_tercero",
      "id_tercero",
      "nit_cliente",
      "Id_cliente",
      "id_cliente",
    ])
  );

const sucursalDeCliente = (row) =>
  String(
    pick(row, [
      "IDSucursal",
      "f201_id_sucursal",
      "Id_sucursal",
      "id_sucursal",
      "SUCURSAL",
      "sucursal",
      "Id_sucursal_fact",
      "sucursal_cliente",
    ]) || ""
  ).trim();

const mapCliente = (row) => {
  let nit = nitDeCliente(row);
  let sucursal = sucursalDeCliente(row);
  if (!sucursal && nit.includes("-")) {
    const [soloNit, sucDesdeNit] = nit.split("-");
    nit = soloNit;
    sucursal = sucDesdeNit || "";
  } else {
    nit = nit.split("-")[0];
  }
  const codigo = String(
    pick(row, [
      "COD_VENDEDOR",
      "f215_id_vendedor",
      "Id_vendedor",
      "id_vendedor",
      "codigo_vendedor",
      "Codigo_vendedor",
      "CODIGO",
      "codigo",
      "VC",
      "vc",
    ]) || ""
  ).trim();
  const nombreVendedor = String(
    pick(row, [
      "Desc_vendedor",
      "descripcion_vendedor",
      "nombre_vendedor",
      "NombreVendedor",
      "f210_descripcion",
      "NomVendedor",
    ]) || ""
  ).trim();
  const dir1 = String(pick(row, ["Dir1", "DIRECCION", "direccion", "f201_direccion1"]) || "").trim();
  const dir2 = String(pick(row, ["Dir2", "Dir3"]) || "").trim();
  return {
    nit,
    sucursal,
    sucursalDescripcion: String(
      pick(row, [
        "DescripSucursal",
        "f201_descripcion",
        "f201_descripcion_sucursal",
        "descripcion_sucursal",
        "Desc_sucursal",
        "nombre_sucursal",
      ]) || ""
    ).trim(),
    codigo,
    vendedor: nombreVendedor || codigo,
    barrio: String(pick(row, ["Barrio", "BARRIO", "barrio"]) || "").trim(),
    municipio: String(
      pick(row, ["Ciudad", "MUNICIPIO", "municipio", "ciudad", "Departamento"]) || ""
    ).trim(),
    direccion: [dir1, dir2].filter(Boolean).join(" ").trim(),
    telefono: String(
      pick(row, ["Telefono", "Celular", "TELEFONO", "telefono", "f201_telefono"]) || ""
    ).trim(),
    bodega: String(
      pick(row, ["BODEGA", "bodega", "Id_bodega", "id_bodega", "f201_id_bodega"]) || ""
    ).trim(),
    contacto: String(
      pick(row, ["Contacto", "CONTACTO", "contacto", "nombre_contacto"]) || ""
    ).trim(),
    cliente: String(
      pick(row, [
        "RazonSocial",
        "f200_razon_social",
        "razon_social",
        "CLIENTE",
        "cliente",
        "Nombres",
      ]) || ""
    ).trim(),
  };
};

const variantesSucursal = (sucursal) => {
  const suc = String(sucursal || "").trim();
  if (!suc) return [""];
  return [...new Set([suc, suc.replace(/^0+/, "") || "0", suc.padStart(3, "0")])];
};

const claveCruce = (nit, sucursal) =>
  `${normalizarNit(nit).split("-")[0]}|${String(sucursal || "").trim()}`;

const indexarClientes = (filas) => {
  const indice = new Map();
  filas.forEach((row) => {
    const cliente = mapCliente(row);
    if (!cliente.nit) return;
    variantesSucursal(cliente.sucursal).forEach((suc) => {
      indice.set(claveCruce(cliente.nit, suc), cliente);
    });
    if (!indice.has(claveCruce(cliente.nit, ""))) {
      indice.set(claveCruce(cliente.nit, ""), cliente);
    }
  });
  return indice;
};

const buscarCliente = (indice, nit, sucursal) => {
  const n = normalizarNit(nit).split("-")[0];
  if (!n) return null;
  for (const suc of variantesSucursal(sucursal)) {
    const found = indice.get(claveCruce(n, suc));
    if (found) return found;
  }
  return indice.get(claveCruce(n, "")) || null;
};

const cruzarPedidosConClientes = (pedidos, indice) => {
  let conCliente = 0;
  const cruzados = pedidos.map((pedido, index) => {
    const row = pedido.siesa?.[0] || {};
    const nit = nitDePedido(row) || String(pedido.nit || "").split("-")[0];
    const sucursal = sucursalDePedido(row) || pedido.sucursal || "";
    const cliente = buscarCliente(indice, nit, sucursal);
    if (index < 3) {
      console.log(
        "cruce pedido",
        pedido.idEnc,
        "nit",
        nit,
        "suc",
        sucursal,
        "clave",
        claveCruce(nit, sucursal),
        cliente ? `COD_VENDEDOR=${cliente.codigo}` : "SIN_MATCH"
      );
    }
    if (!cliente) return pedido;
    conCliente += 1;
    return {
      ...pedido,
      codigo: cliente.codigo || pedido.codigo,
      vendedor:
        (cliente.vendedor && cliente.vendedor !== cliente.codigo
          ? cliente.vendedor
          : "") ||
        (pedido.vendedor && pedido.vendedor !== (pedido.codigo || cliente.codigo)
          ? pedido.vendedor
          : "") ||
        cliente.vendedor ||
        pedido.vendedor,
      sucursalDescripcion:
        cliente.sucursalDescripcion || pedido.sucursalDescripcion || pedido.sucursal,
      barrio: cliente.barrio || pedido.barrio,
      municipio: cliente.municipio || pedido.municipio,
      direccion: cliente.direccion || pedido.direccion,
      telefono: cliente.telefono || pedido.telefono,
      bodega: pedido.bodega,
      contacto: cliente.contacto || pedido.contacto || cliente.sucursalDescripcion,
      barrioPed: cliente.barrio || pedido.barrioPed,
      direccionPed: cliente.direccion || pedido.direccionPed,
      cliente: pedido.cliente || cliente.cliente,
      establecimiento: pedido.establecimiento || cliente.cliente,
    };
  });
  return { pedidos: cruzados, conCliente };
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
  if (corte >= 0) url = url.slice(0, corte);
  return url.replace(/\/+$/, "");
};

const diaSiguiente = (iso) => {
  const [y, m, d] = String(iso)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
};

const sumarDias = (iso, dias) => {
  const [y, m, d] = String(iso)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
};

const tramosDeRango = (desde, hasta, diasPorTramo) => {
  const tramos = [];
  let cursor = desde;
  while (cursor <= hasta) {
    const fin = sumarDias(cursor, diasPorTramo - 1);
    tramos.push({
      desde: cursor,
      hasta: fin <= hasta ? fin : hasta,
    });
    cursor = diaSiguiente(tramos[tramos.length - 1].hasta);
  }
  return tramos;
};

const huellaLote = (filas) => {
  const ext = extremosFecha(filas);
  return `${filas.length}|${ext.min}|${ext.max}`;
};

const claveLineaSiesa = (row) =>
  [
    pick(row, ["id430", "f430_rowid", "NumPedido", "f430_consec_docto", "idEnc"]),
    pick(row, ["LineaRegistro", "f431_rowid"]),
    pick(row, ["id_item", "f120_id", "f431_id_item", "item referencia", "f120_referencia"]),
  ]
    .map((v) => String(v || "").trim())
    .join("|");

const armarParametrosFecha = (desde, hasta) => {
  const custom = (process.env.SIESA_PEDIDOS_PARAMETROS || "").trim();
  if (custom) {
    return custom
      .replaceAll("{desde}", desde)
      .replaceAll("{hasta}", hasta)
      .replaceAll("{hastaExcl}", diaSiguiente(hasta));
  }
  if (!desde) return "";
  const hastaIncl = hasta || desde;
  return `fechaDesde = ${desde}|fechaHasta = ${hastaIncl}`;
};

const extraerQuery = (raw) => {
  const url = (raw || "").trim();
  const corte = url.indexOf("?");
  if (corte < 0) return {};
  try {
    return Object.fromEntries(new URL(url).searchParams.entries());
  } catch (error) {
    return {};
  }
};

const serializarParamsConnekta = (params) =>
  Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");

const configSiesa = () => {
  const key = process.env.SIESA_PEDIDOS_CONNI_KEY || "";
  const token = process.env.SIESA_PEDIDOS_CONNI_TOKEN || "";
  const rawUrl = process.env.SIESA_PEDIDOS_BASE_URL || "";
  const query = extraerQuery(rawUrl);
  return {
    baseUrl: normalizarBaseUrl(rawUrl),
    idCompania:
      process.env.SIESA_PEDIDOS_ID_COMPANIA ||
      query.idCompania ||
      process.env.SIESA_ID_COMPANIA ||
      "55",
    consulta:
      process.env.SIESA_CONSULTA_PEDIDOS ||
      query.descripcion ||
      "carnicosyalimentos_Detalle_pedidos",
    consultaClientes:
      process.env.SIESA_CONSULTA_CLIENTES ||
      "carnicosyalimentos_TercerosClienteDinamico",
    baseUrlClientes: normalizarBaseUrl(
      process.env.SIESA_CLIENTES_BASE_URL ||
        "https://serviciosqa.siesacloud.com/api/connekta/v3.1/ejecutarconsulta"
    ),
    idCiaUnoee:
      process.env.SIESA_ID_CIA || "13",
    headers: {
      "Content-Type": "application/json",
      ConnKey: key,
      ConnToken: token,
      ConniKey: key,
      ConniToken: token,
    },
  };
};

const rangoPorDefecto = () => ({
  desde: process.env.SIESA_PEDIDOS_FECHA_DESDE || "2025-12-26",
  hasta: process.env.SIESA_PEDIDOS_FECHA_HASTA || "2025-12-31",
});

const fechaDeFila = (row) => fechaDocumentoDeFila(row);

const enRango = (row, desde, hasta) => {
  const dia = fechaDeFila(row);
  return Boolean(dia) && dia >= desde && dia <= hasta;
};

const extremosFecha = (filas) => {
  const fechas = filas.map(fechaDeFila).filter(Boolean).sort();
  return {
    min: fechas[0] || "",
    max: fechas[fechas.length - 1] || "",
  };
};

const pedirPagina = async ({
  pagina,
  pageSize = 100,
  parametros,
  consulta: consultaOverride,
  baseUrl: baseUrlOverride,
} = {}) => {
  const { baseUrl, idCompania, consulta, headers } = configSiesa();
  const descripcion = consultaOverride || consulta;
  const url = baseUrlOverride || baseUrl;
  const params = {
    idCompania,
    descripcion,
    paginacion: `numPag=${pagina}|tamPag=${pageSize}`,
  };
  if (parametros) params.parametros = parametros;

  asegurarNoCancelado();
  const timeoutMs = Number(process.env.SIESA_PEDIDOS_TIMEOUT_MS || 180000);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  etlAbortController.signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  console.log(`[pedidos-siesa] GET ${descripcion} numPag=${pagina} tamPag=${pageSize} ${parametros || "sin parametros"}`);
  let response;
  try {
    response = await axios.get(url, {
      params,
      paramsSerializer: serializarParamsConnekta,
      headers,
      timeout: timeoutMs,
      signal: controller.signal,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (error) {
    const elapsed = Date.now() - t0;
    if (etlEstaCancelado()) throw errorEtlCancelado();
    if (error.code === "ERR_CANCELED" || error.name === "CanceledError" || error.code === "ECONNABORTED") {
      const timeoutError = new Error(
        `SIESA no respondió a tiempo (${Math.round(elapsed / 1000)}s) en ${descripcion} página ${pagina}. La consulta SQL de Connekta está muy pesada; reduzca el rango de fechas literales en el SQL.`
      );
      timeoutError.status = 504;
      timeoutError.consulta = descripcion;
      timeoutError.timeout = true;
      throw timeoutError;
    }
    const http = error.response?.status;
    const detalleSiesa =
      typeof error.response?.data?.detalle === "string"
        ? error.response.data.detalle
        : typeof error.response?.data?.mensaje === "string"
          ? error.response.data.mensaje
          : "";
    if (/no maneja parametros/i.test(detalleSiesa) || /Must declare the scalar variable/i.test(detalleSiesa) || /variable sin haberla declarado/i.test(detalleSiesa)) {
      const filtroError = new Error(
        `La consulta ${descripcion} no sustituyó {fechaDesde}. En el SQL use llaves {fechaDesde} y {fechaHasta} (no @). En Postman: parametros=fechaDesde = 2026-08-25|fechaHasta = 2026-08-25.`
      );
      filtroError.status = 400;
      filtroError.consulta = descripcion;
      throw filtroError;
    }
    if (http >= 500) {
      const extra = detalleSiesa
        ? ` Detalle Connekta: ${String(detalleSiesa).slice(0, 400)}`
        : "";
      const conversionFecha =
        /converting date and\/or time from character string/i.test(detalleSiesa);
      const siesaError = new Error(
        conversionFecha
          ? `La consulta ${descripcion} falló en Connekta al convertir una fecha (CONVERT/CAST). El calendario de la app no se envía a ese SQL. Quite CONVERT sobre {fechaDesde} o sobre f430_fecha_ts_actualizacion; deje T430.f430_id_fecha >= '2026-01-01' (literal).`
          : `SIESA HTTP ${http} en ${descripcion} página ${pagina}.${extra || " La consulta falló en SQL (columna inválida) o está sobrecargada; reduce el rango de fechas en Connekta."}`
      );
      siesaError.status = 502;
      siesaError.consulta = descripcion;
      siesaError.timeout = pagina > 1;
      throw siesaError;
    }
    throw error;
  } finally {
    etlAbortController.signal.removeEventListener("abort", onAbort);
    clearTimeout(timer);
  }
  const payload = response.data || {};
  if (payload.codigo && Number(payload.codigo) !== 0) {
    const error = new Error(
      payload.detalle ||
        payload.mensaje ||
        `SIESA rechazó la consulta ${descripcion}.`
    );
    error.status = 502;
    error.consulta = descripcion;
    throw error;
  }
  const meta = metaPaginacion(payload);
  const filas = extraerFilas(payload);
  let totalPaginas = meta.totalPaginas || 1;
  const totalRegistros = meta.totalRegistros || filas.length;
  if (totalPaginas >= totalRegistros && totalRegistros > pageSize) {
    totalPaginas = Math.max(1, Math.ceil(totalRegistros / pageSize));
  }
  const fechas = extremosFecha(filas);
  console.log(
    `[pedidos-siesa] OK ${descripcion} numPag=${pagina} ${Date.now() - t0}ms filas=${filas.length} registros=${totalRegistros} paginas=${totalPaginas} fechas=${fechas.min || "-"}..${fechas.max || "-"}`
  );
  return {
    filas,
    pagina,
    totalPaginas,
    totalRegistros,
    ...fechas,
  };
};

const buscarPaginasDelRango = async ({
  desde,
  hasta,
  pageSize,
  parametros,
  totalPaginas,
  cache,
}) => {
  const paginaDe = async (pagina) => {
    if (cache.has(pagina)) return cache.get(pagina);
    try {
      const lote = await pedirPagina({ pagina, pageSize, parametros });
      cache.set(pagina, lote);
      return lote;
    } catch (error) {
      const http = error.response?.status || error.status;
      if (error.timeout || http >= 500) {
        console.log(
          `[pedidos-siesa] ${error.timeout ? "timeout" : `HTTP ${http}`} numPag=${pagina}; no uso páginas >= ${pagina}`
        );
        return { filas: [], min: "", max: "", timeout: true, pagina };
      }
      throw error;
    }
  };

  const primera = await paginaDe(1);
  const TOPE_ULTIMA = 40;
  let ascendente = true;
  if (totalPaginas > 1 && totalPaginas <= TOPE_ULTIMA) {
    const ultima = await paginaDe(totalPaginas);
    ascendente = (ultima.max || "") >= (primera.max || "");
  } else if (primera.max && desde && primera.max < desde) {
    console.log(
      `[pedidos-siesa] asumo orden ascendente: pagina 1 max=${primera.max} < ${desde}; no pido ultima pagina (${totalPaginas})`
    );
  } else if (primera.min && hasta && primera.min > hasta) {
    ascendente = false;
  }

  if (primera.timeout) return { inicio: 0, fin: 0 };

  if (totalPaginas > TOPE_ULTIMA) {
    let lastOk = 1;
    let probe = 2;
    while (probe <= totalPaginas) {
      const lote = await paginaDe(probe);
      if (lote.timeout) {
        let lo = lastOk + 1;
        let hi = probe - 1;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          const midLote = await paginaDe(mid);
          if (midLote.timeout) hi = mid - 1;
          else {
            lastOk = mid;
            lo = mid + 1;
          }
        }
        break;
      }
      lastOk = probe;
      if (probe === totalPaginas) break;
      probe = Math.min(totalPaginas, probe * 2);
    }
    console.log(
      `[pedidos-siesa] páginas alcanzables 1-${lastOk} de ${totalPaginas}`
    );
    totalPaginas = lastOk;
  }

  let inicio = 1;
  let fin = totalPaginas;

  if (ascendente) {
    let lo = 1;
    let hi = totalPaginas;
    inicio = totalPaginas + 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const lote = await paginaDe(mid);
      if (lote.timeout) {
        hi = mid - 1;
        continue;
      }
      if (lote.max && lote.max >= desde) {
        inicio = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    lo = Math.min(inicio, totalPaginas);
    hi = totalPaginas;
    fin = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const lote = await paginaDe(mid);
      if (lote.timeout) {
        hi = mid - 1;
        continue;
      }
      if (!lote.min || lote.min <= hasta) {
        fin = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  } else {
    let lo = 1;
    let hi = totalPaginas;
    inicio = totalPaginas + 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const lote = await paginaDe(mid);
      if (lote.timeout) {
        hi = mid - 1;
        continue;
      }
      if (lote.min && lote.min <= hasta) {
        inicio = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    lo = Math.min(inicio, totalPaginas);
    hi = totalPaginas;
    fin = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const lote = await paginaDe(mid);
      if (lote.timeout) {
        hi = mid - 1;
        continue;
      }
      if (lote.max && lote.max >= desde) {
        fin = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  }

  if (inicio > totalPaginas || fin < 1 || inicio > fin) {
    return { inicio: 0, fin: 0 };
  }
  return { inicio, fin };
};

const filasDePaginasEnRango = async ({
  primera,
  pageSize,
  parametros,
  desde,
  hasta,
}) => {
  const metaPaginas = Number(primera.totalPaginas || 0);
  const totalRegistros =
    Number(primera.totalRegistros || 0) || (primera.filas || []).length;
  const tamReal = (primera.filas || []).length || pageSize;
  const totalPaginas =
    metaPaginas > 1
      ? metaPaginas
      : Math.max(1, Math.ceil(totalRegistros / Math.max(tamReal, 1)));
  const dumpCompleto =
    (primera.filas || []).length > pageSize ||
    (totalPaginas <= 1 && totalRegistros <= (primera.filas || []).length);

  if (dumpCompleto) {
    return { filas: primera.filas || [], paginasLeidas: "1" };
  }

  const { min, max } = extremosFecha(primera.filas || []);
  const paramsYaFiltran =
    Boolean(parametros) &&
    min &&
    max &&
    desde &&
    hasta &&
    min >= desde &&
    max <= hasta;

  if (paramsYaFiltran && totalPaginas > 1) {
    const filas = [...(primera.filas || [])];
    const concurrency = Math.max(
      1,
      Number(process.env.SIESA_PEDIDOS_CONCURRENCIA || 4)
    );
    for (let pagina = 2; pagina <= totalPaginas; pagina += concurrency) {
      asegurarNoCancelado();
      const lote = [];
      for (let j = 0; j < concurrency && pagina + j <= totalPaginas; j += 1) {
        lote.push(pedirPagina({ pagina: pagina + j, pageSize, parametros }));
      }
      const pages = await Promise.all(lote);
      pages.forEach((page) => {
        if (page.timeout || !page.filas) return;
        filas.push(...page.filas);
      });
      console.log(
        `[pedidos-siesa] páginas ${pagina}-${Math.min(
          pagina + concurrency - 1,
          totalPaginas
        )}/${totalPaginas} acumuladas=${filas.length}`
      );
    }
    return { filas, paginasLeidas: `1-${totalPaginas}/${totalPaginas}` };
  }

  const cache = new Map([[1, primera]]);
  const { inicio, fin } = await buscarPaginasDelRango({
    desde,
    hasta: hasta || desde,
    pageSize,
    parametros,
    totalPaginas,
    cache,
  });
  const filas = [];
  if (inicio && fin) {
    for (let pagina = inicio; pagina <= fin; pagina += 1) {
      asegurarNoCancelado();
      const page = cache.has(pagina)
        ? cache.get(pagina)
        : await pedirPagina({ pagina, pageSize, parametros });
      if (page.timeout || !page.filas) continue;
      cache.set(pagina, page);
      filas.push(...page.filas);
    }
  }
  return {
    filas,
    paginasLeidas: inicio && fin ? `${inicio}-${fin}/${totalPaginas}` : "0",
  };
};

const usaParametrosConnekta = () =>
  /^(1|true|si)$/i.test(String(process.env.SIESA_PEDIDOS_USA_PARAMETROS || "").trim());

const descargarPaginasConsulta = async ({ pageSize, desde, hasta } = {}) => {
  const primera = await pedirPagina({ pagina: 1, pageSize });
  return filasDePaginasEnRango({
    primera,
    pageSize,
    desde,
    hasta: hasta || desde,
  });
};

const descargarPedidosSiesa = async ({
  desde = rangoPorDefecto().desde,
  hasta = rangoPorDefecto().hasta,
} = {}) => {
  const { baseUrl, consulta, headers } = configSiesa();

  if (!baseUrl) {
    const error = new Error(
      "Falta SIESA_PEDIDOS_BASE_URL en el .env. Pedidos no usa la URL de Items."
    );
    error.status = 400;
    error.consulta = consulta;
    throw error;
  }

  if (!headers.ConniKey || !headers.ConniToken) {
    const error = new Error(
      "Faltan SIESA_PEDIDOS_CONNI_KEY y SIESA_PEDIDOS_CONNI_TOKEN en el .env. Son distintos a los de Items."
    );
    error.status = 400;
    error.consulta = consulta;
    throw error;
  }

  const pageSize = Number(process.env.SIESA_PEDIDOS_TAM_PAG || 5000);

  if (!usaParametrosConnekta()) {
    const { filas: filasBruto, paginasLeidas } = await descargarPaginasConsulta({
      pageSize,
      desde,
      hasta,
    });
    const vistos = new Set();
    const unicas = [];
    filasBruto.forEach((row) => {
      const clave = claveLineaSiesa(row);
      if (vistos.has(clave)) return;
      vistos.add(clave);
      unicas.push(row);
    });
    const filas = unicas.filter((row) => enRango(row, desde, hasta));
    const fechasTodas = [
      ...new Set(unicas.map(fechaDeFila).filter(Boolean)),
    ].sort();
    let aviso = "";
    if (unicas.length && !filas.length) {
      aviso = `Connekta trajo pedidos del ${fechasTodas[0] || "?"} al ${
        fechasTodas[fechasTodas.length - 1] || "?"
      }. Ninguno cae en ${desde}..${hasta}. Ajuste Desde/Hasta o las fechas literales del SQL en Connekta.`;
    }
    return {
      consulta,
      filas,
      desde,
      hasta,
      parametrosUsados: "sin parametros (filtro local)",
      totalFilasSiesa: filas.length,
      fechasEncontradas: [...new Set(filas.map(fechaDeFila).filter(Boolean))].sort(),
      fechasFueraDeRango: fechasTodas,
      totalFilasSinFiltrar: unicas.length,
      paginasLeidas,
      aviso,
    };
  }

  const diasLote = Number(process.env.SIESA_PEDIDOS_DIAS_LOTE || 40);
  const tramos = tramosDeRango(desde, hasta, Math.max(1, diasLote));
  const vistos = new Set();
  const filasBruto = [];
  let aviso = "";
  let paginasLeidas = "0";
  let parametrosUsados = armarParametrosFecha(desde, hasta);
  let huellaAnterior = "";

  for (let i = 0; i < tramos.length; i += 1) {
    asegurarNoCancelado();
    const tramo = tramos[i];
    const parametros = armarParametrosFecha(tramo.desde, tramo.hasta);
    parametrosUsados = parametros;
    const lote = await pedirPagina({ pagina: 1, pageSize, parametros });
    if (!(lote.filas || []).length && !Number(lote.totalRegistros || 0)) {
      aviso = `Connekta no devolvió filas para ${tramo.desde}..${tramo.hasta} con parametros.`;
      console.log(`[pedidos-siesa] ${aviso}`);
      break;
    }
    const ignoraPaginacion = lote.filas.length > pageSize;
    const huella = huellaLote(lote.filas);
    if (i > 0 && huella && huella === huellaAnterior) {
      aviso =
        "Connekta devolvió el mismo lote en cada rango. El SQL debe usar {fechaDesde} y {fechaHasta} sobre T430.f430_fecha_ts_actualizacion.";
      console.log(`[pedidos-siesa] ${aviso}`);
      break;
    }
    huellaAnterior = huella;

    let delTramo = lote.filas;
    if (!ignoraPaginacion) {
      const ranged = await filasDePaginasEnRango({
        primera: lote,
        pageSize,
        parametros,
        desde: tramo.desde,
        hasta: tramo.hasta,
      });
      delTramo = ranged.filas;
      paginasLeidas = ranged.paginasLeidas;
    }

    delTramo.forEach((row) => {
      const clave = claveLineaSiesa(row);
      if (vistos.has(clave)) return;
      vistos.add(clave);
      filasBruto.push(row);
    });
    console.log(
      `[pedidos-siesa] tramo ${tramo.desde}..${tramo.hasta} filas=${delTramo.length} acumuladas=${filasBruto.length} paginas=${paginasLeidas}`
    );
    paginasLeidas = `${paginasLeidas} tramo ${i + 1}/${tramos.length}`;
  }

  const filas = filasBruto.filter((row) => enRango(row, desde, hasta));
  const fechasTodas = [
    ...new Set(filasBruto.map(fechaDeFila).filter(Boolean)),
  ].sort();

  if (!filas.length) {
    return {
      consulta,
      filas,
      desde,
      hasta,
      parametrosUsados,
      totalFilasSiesa: 0,
      fechasEncontradas: [],
      fechasFueraDeRango: fechasTodas,
      totalFilasSinFiltrar: filasBruto.length,
      paginasLeidas,
      aviso:
        aviso ||
        `Connekta no trajo pedidos del ${desde} al ${hasta} con parametros.`,
    };
  }

  return {
    consulta,
    filas,
    desde,
    hasta,
    parametrosUsados: parametrosUsados || "fecha_desde/fecha_hasta",
    totalFilasSiesa: filas.length,
    fechasEncontradas: [...new Set(filas.map(fechaDeFila).filter(Boolean))].sort(),
    fechasFueraDeRango: fechasTodas,
    totalFilasSinFiltrar: filasBruto.length,
    paginasLeidas,
    aviso,
  };
};

const idCiaDeCliente = (row) =>
  String(pick(row, ["f200_id_cia", "id_cia", "Id_cia"]) || "").trim();

const clienteDeCia = (row, idCia) => {
  const cia = idCiaDeCliente(row);
  const permitidas = String(idCia)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return permitidas.some(
    (permitida) => cia === permitida || Number(cia) === Number(permitida)
  );
};

const CACHE_CLIENTES_MS = Number(process.env.SIESA_CLIENTES_CACHE_MS || 3600000);
const cacheClientes = { at: 0, descarga: null };

const descargarClientesSiesa = async () => {
  const { baseUrlClientes, consultaClientes, headers, idCiaUnoee } =
    configSiesa();

  if (cacheClientes.descarga && Date.now() - cacheClientes.at < CACHE_CLIENTES_MS) {
    console.log(
      `[pedidos-siesa] clientes en cache (${cacheClientes.descarga.totalFilasSiesa} filas)`
    );
    return cacheClientes.descarga;
  }

  if (!baseUrlClientes) {
    const error = new Error(
      "Falta SIESA_CLIENTES_BASE_URL en el .env (v3.1 de TercerosClienteDinamico)."
    );
    error.status = 400;
    error.consulta = consultaClientes;
    throw error;
  }

  if (!headers.ConniKey || !headers.ConniToken) {
    const error = new Error(
      "Faltan SIESA_PEDIDOS_CONNI_KEY y SIESA_PEDIDOS_CONNI_TOKEN en el .env."
    );
    error.status = 400;
    error.consulta = consultaClientes;
    throw error;
  }

  const pageSize = Number(process.env.SIESA_CLIENTES_TAM_PAG || 100);
  const tope = Number(process.env.SIESA_CLIENTES_MAX_PAGINAS || 500);
  const filasBruto = [];
  let totalPaginas = 1;
  let ultimo = 0;

  for (let pagina = 1; pagina <= tope; pagina += 1) {
    asegurarNoCancelado();
    const lote = await pedirPagina({
      pagina,
      pageSize,
      consulta: consultaClientes,
      baseUrl: baseUrlClientes,
    });
    if (lote.totalPaginas) {
      totalPaginas = Math.max(totalPaginas, lote.totalPaginas);
    }
    if (!lote.filas.length) {
      ultimo = Math.max(0, pagina - 1);
      break;
    }
    filasBruto.push(...lote.filas);
    ultimo = pagina;
    const metaDiceSigue = pagina < totalPaginas;
    const paginaLlena = lote.filas.length >= pageSize;
    if (!metaDiceSigue && !paginaLlena) break;
  }

  const ciasVistas = [
    ...new Set(filasBruto.map((row) => idCiaDeCliente(row) || "(vacio)")),
  ];
  const filas = filasBruto.filter((row) => clienteDeCia(row, idCiaUnoee));

  if (filasBruto[0]) {
    console.log(
      `${consultaClientes} columnas:`,
      Object.keys(filasBruto[0]).join(", ")
    );
    console.log(
      `${consultaClientes} f200_id_cia vistos:`,
      ciasVistas.join(","),
      "filas",
      filasBruto.length,
      "cia",
      idCiaUnoee,
      "despues filtro",
      filas.length,
      "paginas",
      `1-${ultimo} de ${totalPaginas}`
    );
  }

  const descarga = {
    consulta: consultaClientes,
    filas,
    totalFilasSiesa: filas.length,
    totalFilasSinFiltrar: filasBruto.length,
    idCia: idCiaUnoee,
    paginasLeidas: `1-${ultimo} de ${totalPaginas}`,
    columnas: filasBruto[0] ? Object.keys(filasBruto[0]) : [],
  };
  cacheClientes.at = Date.now();
  cacheClientes.descarga = descarga;
  return descarga;
};

const numeroDe = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const mapLineaPedido = (row) => {
  const unidad = String(
    pick(row, ["id_unidad_medida", "f431_id_unidad_medida", "UM", "unidad", "UND"]) || ""
  ).trim();
  const kilos = pick(row, [
    "kilo",
    "KILO",
    "cant1_pedida",
    "f431_cant1_pedida",
    "CantidadKilos",
    "PesoMovOriginal",
  ]);
  const unidades = pick(row, ["unidades", "Unidades", "cant2_pedida", "f431_cant2_pedida"]);
  const um = unidad.toUpperCase();
  // En esta cia cant1 = kg y Unidades/cant2 = UND (igual que f470_cant_1 / f470_cant_2).
  const cantUnd = um === "UND" ? unidades || kilos : unidades || kilos;
  const cantKg = um === "UND" ? kilos || unidades : kilos || unidades;
  const cant = cantUnd || kilos;
  const valor = pick(row, ["vlr_neto", "f431_vlr_neto", "VrNeto", "VALOR", "valor"]);
  const vlrBruto = pick(row, ["vlr_bruto", "f431_vlr_bruto", "ValorBrutoMov", "VrBruto"]);
  const cantN = numeroDe(cant);
  const valorN = numeroDe(valor);
  let vUnit = pick(row, [
    "V_UNIT",
    "v_unit",
    "vUnit",
    "precio_unitario",
    "f431_precio_unitario",
    "f431_precio_unitario_base",
    "precio",
  ]);
  if (!vUnit && cantN) vUnit = Number((valorN / cantN).toFixed(4));
  return {
    codigo: String(
      pick(row, [
        "item referencia",
        "item_referencia",
        "Referencia",
        "f120_referencia",
        "codigo",
      ]) || ""
    ).trim(),
    producto: String(
      pick(row, [
        "item descripcion",
        "item_descripcion",
        "f120_descripcion",
        "PRODUCTO",
        "producto",
        "DescripcionItem",
      ]) || ""
    ).trim(),
    cant,
    unidad,
    vUnit,
    valor,
    vlrBruto,
    cant2: cantKg,
    kilo: cantKg,
    unidades: cantUnd,
    idDetenc: String(
      pick(row, [
        "ID_DETENC",
        "idDetenc",
        "LineaRegistro",
        "id_ext1_detalle",
        "f431_rowid",
      ]) || ""
    ).trim(),
    nroRegistro: String(
      pick(row, [
        "nro_registro",
        "NroRegistro",
        "nroRegistro",
        "LineaRegistro",
        "f431_rowid",
      ]) || ""
    ).trim(),
    idItem: String(pick(row, ["id_item", "f120_id", "Id_item", "f431_id_item"]) || "").trim(),
    notas: pick(row, ["notas_linea", "notas_pedido", "f431_notas", "notas"]),
    bodega: bodegaDistintaDeCo(pickBodegaCruda(row), pickCo(row)),
    motivo: pick(row, ["id_motivo", "Motivo"]),
    motivoDesc: pick(row, ["DescripcionMotivo", "desc_motivo"]),
    listaPrecio: pick(row, ["id_lista_precio", "ListaPrecio"]),
    co: pickCo(row),
    unNegocio: pick(row, ["Id_un_movto", "id_un_movto"]),
    fechaEntrega: String(
      pick(row, ["Fecha_entrega", "fecha_entrega", "f430_fecha_entrega", "f431_fecha_entrega"]) || ""
    ).slice(0, 10),
    estado: etiquetaEstado(row),
    canastas: pick(row, ["CANASTAS", "canastas", "numero_canastas"]),
    bultos: pick(row, ["BULTOS", "bultos", "numero_bultos"]),
    cajas: pick(row, ["CAJAS", "cajas", "numero_cajas"]),
  };
};

const lineaConProducto = (linea) =>
  Boolean(linea && (linea.codigo || linea.producto || linea.cant));

const conNro = (lineas) =>
  lineas.map((linea, i) => ({
    ...linea,
    nroRegistro: String(linea.nroRegistro || i + 1).trim(),
  }));

const lineasDePedido = (pedido = {}) => {
  const siesa = Array.isArray(pedido.siesa) ? pedido.siesa : [];
  const deSiesa = siesa.map(mapLineaPedido).filter(lineaConProducto);
  if (deSiesa.length) return conNro(deSiesa);
  const propias = Array.isArray(pedido.lineas) ? pedido.lineas : [];
  return conNro(propias.map(mapLineaPedido).filter(lineaConProducto));
};

const agruparPorPedido = (filas) => {
  const grupos = new Map();

  filas.forEach((row, index) => {
    const cabecera = mapCabecera(row);
    const idEnc = cabecera.idEnc || `sin-id-${index}`;
    if (!grupos.has(idEnc)) {
      grupos.set(idEnc, {
        ...cabecera,
        idEnc,
        valor: 0,
        lineas: [],
        siesa: [],
      });
    }
    const grupo = grupos.get(idEnc);
    grupo.lineas.push(mapLineaPedido(row));
    grupo.siesa.push(row);
    const vlr = Number(
      pick(row, ["vlr_neto", "f431_vlr_neto", "vlr_bruto", "f431_vlr_bruto", "VALOR", "valor"]) || 0
    );
    if (Number.isFinite(vlr)) grupo.valor = Number(grupo.valor || 0) + vlr;
  });

  return Array.from(grupos.values()).map((grupo) => {
    const primera = grupo.lineas[0] || {};
    const co = String(grupo.co || primera.co || "").trim();
    const bodegaLinea = String(primera.bodega || "").trim();
    const bodegaCab = String(grupo.bodega || "").trim();
    const bodega =
      (bodegaLinea && bodegaLinea !== co && bodegaLinea) ||
      (bodegaCab && bodegaCab !== co && bodegaCab) ||
      "";
    return {
      ...grupo,
      bodega,
      observacion: grupo.observacion || primera.notas || "",
      estado: grupo.estado || primera.estado || "",
      fechaEntrega: grupo.fechaEntrega || primera.fechaEntrega || "",
      co,
    };
  });
};

const persistirStaging = async (filas, { desde, hasta, ahora }) => {
  const ops = filas
    .map((row) => {
      const lineaId = claveLineaSiesa(row);
      if (!lineaId) return null;
      return {
        updateOne: {
          filter: { lineaId },
          update: {
            $set: {
              lineaId,
              idEnc: String(
                pick(row, ["NumPedido", "f430_consec_docto", "idEnc"]) || ""
              ),
              tipoDocto: String(
                pick(row, ["TipoDocPedido", "f430_id_tipo_docto"]) || ""
              ),
              fecha: fechaDeFila(row),
              nit: String(pick(row, ["Nit", "nit", "f200_nit", "f200_nit_fact"]) || ""),
              payload: row,
              extraidoEn: ahora,
              tramoDesde: desde,
              tramoHasta: hasta,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);
  for (let i = 0; i < ops.length; i += 500) {
    await siesaEtlLineas.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }
  return ops.length;
};

const enriquecerPedidosLocalesConClientes = async () => {
  const descarga = await descargarClientesSiesa();
  if (!(descarga.filas || []).length) {
    const error = new Error(
      `La consulta ${descarga.consulta} no devolvió clientes con f200_id_cia=${descarga.idCia}.`
    );
    error.status = 400;
    error.consulta = descarga.consulta;
    throw error;
  }
  const indice = indexarClientes(descarga.filas);
  console.log(
    "cruce indice ejemplo",
    [...indice.keys()].slice(0, 8).join(" | ")
  );
  const locales = await pedidosModel.find().lean();
  const { pedidos, conCliente } = cruzarPedidosConClientes(locales, indice);
  let actualizados = 0;
  for (const pedido of pedidos) {
    const resultado = await pedidosModel.updateOne(
      { idEnc: pedido.idEnc },
      {
        $set: {
          codigo: pedido.codigo || "",
          vendedor: pedido.vendedor || "",
          sucursalDescripcion: pedido.sucursalDescripcion || "",
          barrio: pedido.barrio || "",
          municipio: pedido.municipio || "",
          direccion: pedido.direccion || "",
          telefono: pedido.telefono || "",
          contacto: pedido.contacto || "",
          barrioPed: pedido.barrioPed || "",
          direccionPed: pedido.direccionPed || "",
        },
      }
    );
    if (resultado.modifiedCount) actualizados += 1;
  }
  return {
    consulta: descarga.consulta,
    clientes: descarga.totalFilasSiesa,
    idCia: descarga.idCia,
    pedidos: pedidos.length,
    conCliente,
    actualizados,
  };
};

export {
  agruparPorPedido,
  configSiesa,
  cruzarPedidosConClientes,
  descargarClientesSiesa,
  descargarPedidosSiesa,
  enriquecerPedidosLocalesConClientes,
  indexarClientes,
  lineasDePedido,
  etiquetaEstado,
  mapLineaPedido,
  persistirStaging,
  rangoPorDefecto,
  resolverBodegaPedido,
};

export default {
  agruparPorPedido,
  configSiesa,
  cruzarPedidosConClientes,
  descargarClientesSiesa,
  descargarPedidosSiesa,
  enriquecerPedidosLocalesConClientes,
  etiquetaEstado,
  indexarClientes,
  lineasDePedido,
  mapLineaPedido,
  persistirStaging,
  rangoPorDefecto,
  resolverBodegaPedido,
};
