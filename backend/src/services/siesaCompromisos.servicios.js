import axios from "axios";
import itemsModel from "../models/items.models";
import carguesModel from "../models/cargues.models";
import pedidosModel from "../models/pedidos.models";
import compromisosLogModel from "../models/compromisosLog.models";
import siesaPedidos from "./siesaPedidos.servicios";
import { normalizarLineaPiso, num } from "./piso.servicios";

const txt = (valor) => String(valor ?? "").trim();

const qty = (valor) => {
  const n = num(valor);
  if (!(n > 0)) return "0";
  return String(Number(n.toFixed(4)));
};

const esReapro = (doc) => {
  const tipo = String(doc?.tipo || doc?.tipoDoc || "").toUpperCase();
  return tipo === "REAPRO" || tipo.includes("REAPRO");
};

export const configCompromisos = () => {
  const { headers, idCompania } = siesaPedidos.configSiesa();
  const idCia = txt(process.env.SIESA_ID_CIA || "13");
  const idSistema = txt(process.env.SIESA_ID_SISTEMA || process.env.SIESA_COMPROMISOS_ID_SISTEMA || "1");
  const idDocumento = txt(process.env.SIESA_COMPROMISOS_ID_DOCUMENTO || "253555");
  const nombreDocumento = txt(process.env.SIESA_COMPROMISOS_NOMBRE || "PedidosCompromisos");
  const baseUrl = txt(
    process.env.SIESA_COMPROMISOS_URL ||
      "https://serviciosqa.siesacloud.com/api/siesa/v3.1/conectoresimportar"
  ).replace(/\?.*$/, "");
  return {
    baseUrl,
    idCompania,
    idCia,
    idSistema,
    idDocumento,
    nombreDocumento,
    headers,
    url: `${baseUrl}?idCompania=${encodeURIComponent(idCompania)}&idSistema=${encodeURIComponent(
      idSistema
    )}&idDocumento=${encodeURIComponent(idDocumento)}&nombreDocumento=${encodeURIComponent(
      nombreDocumento
    )}`,
  };
};

const claveItem = (valor) => txt(valor).toUpperCase();

const indexarItems = (docs) => {
  const mapa = new Map();
  for (const it of docs || []) {
    for (const key of [it.referencia, it.codigoItem, it.item]) {
      const k = claveItem(key);
      if (k && !mapa.has(k)) mapa.set(k, it);
    }
  }
  return mapa;
};

const payloadSiesa = (filas, idCia) => ({
  Inicial: [{ F_CIA: idCia }],
  Compromisos: filas,
  Final: [{ F_CIA: idCia }],
});

const siesaOk = (data) => {
  if (data == null) return true;
  const codigo = data.codigo ?? data.Codigo ?? data.code;
  if (codigo === 0 || codigo === "0") return true;
  if (codigo && Number(codigo) > 0) return false;
  const estado = txt(data.estado || data.Estado).toLowerCase();
  if (estado && ["error", "fallo", "failed"].some((w) => estado.includes(w))) return false;
  return true;
};

const textoDetalle = (valor) => {
  if (valor == null) return "";
  if (typeof valor === "string" || typeof valor === "number") return txt(valor);
  if (Array.isArray(valor)) {
    return valor
      .map((item) => txt(item?.f_detalle || item?.detalle || item?.mensaje || textoDetalle(item)))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof valor === "object") {
    return txt(valor.f_detalle || valor.detalle || valor.mensaje || valor.Mensaje);
  }
  return txt(valor);
};

const mensajeSiesa = (data, fallback) =>
  textoDetalle(data?.detalle) ||
  textoDetalle(data?.Detalle) ||
  textoDetalle(data?.mensaje) ||
  textoDetalle(data?.Mensaje) ||
  textoDetalle(data?.message) ||
  fallback;

const lineaEnviada = (fila) => ({
  co: txt(fila?.f430_id_co),
  tipoDocto: txt(fila?.f430_id_tipo_docto),
  consecutivo: txt(fila?.f430_consec_docto),
  item: txt(fila?.f431_id_item),
  referencia: txt(fila?.f431_referencia_item),
  bodega: txt(fila?.f431_id_bodega),
  um: txt(fila?.f431_id_unidad_medida),
  kg: txt(fila?.f431_cant_base),
  unidades: txt(fila?.f431_cant_2),
  nroRegistro: txt(fila?.f431_nro_registro),
});

const erroresDeRespuesta = (data) => {
  const bruto = data?.detalle ?? data?.Detalle ?? data?.errores ?? data?.Errores;
  const lista = Array.isArray(bruto) ? bruto : bruto != null ? [bruto] : [];
  return lista
    .map((item) => {
      if (item == null) return null;
      if (typeof item === "string" || typeof item === "number") {
        return { detalle: txt(item), valor: "", linea: "" };
      }
      const detalle = txt(item.f_detalle || item.detalle || item.mensaje || item.Mensaje);
      if (!detalle) return null;
      return {
        detalle,
        valor: txt(item.f_valor || item.valor || item.item || item.referencia),
        linea: txt(item.f_nro_linea || item.nro || item.linea),
      };
    })
    .filter(Boolean);
};

const guardarLog = async (doc) => {
  try {
    await compromisosLogModel.create({
      idEnc: txt(doc.idEnc),
      cliente: txt(doc.cliente),
      usuario: txt(doc.usuario),
      fecha: doc.fecha || new Date(),
      resultado: txt(doc.resultado || "error"),
      mensaje: txt(doc.mensaje),
      filas: Number(doc.filas || 0),
      faltantes: Array.isArray(doc.faltantes) ? doc.faltantes.map(txt).filter(Boolean) : [],
      lineas: Array.isArray(doc.lineas) ? doc.lineas : [],
      errores: Array.isArray(doc.errores) ? doc.errores : erroresDeRespuesta(doc.respuesta),
      payload: doc.payload || null,
      respuesta: doc.respuesta || null,
      origen: txt(doc.origen || "envio"),
    });
  } catch (error) {
    console.error("[compromisos-log]", error.message);
  }
};

const compromisoPedido = ({ estado, mensaje, usuario, fecha, filas, respuesta }) => ({
  estado,
  mensaje,
  usuario,
  fecha,
  filas: filas || 0,
  respuesta: respuesta || null,
});

export const listarLogsCompromiso = async ({ idEnc, desde, hasta, limite = 200 } = {}) => {
  await backfillLogsDesdePedidos();
  const filtro = { $nor: [{ origen: "pedido", resultado: "pendiente" }] };
  if (txt(idEnc)) filtro.idEnc = txt(idEnc);
  if (desde || hasta) {
    filtro.fecha = {};
    if (desde) filtro.fecha.$gte = new Date(`${String(desde).slice(0, 10)}T00:00:00.000`);
    if (hasta) filtro.fecha.$lte = new Date(`${String(hasta).slice(0, 10)}T23:59:59.999`);
  }
  return compromisosLogModel
    .find(filtro)
    .sort({ fecha: -1 })
    .limit(Math.min(Number(limite) || 200, 500))
    .lean();
};

const backfillLogsDesdePedidos = async () => {
  const pedidos = await pedidosModel
    .find({ "compromiso.fecha": { $ne: null } }, { idEnc: 1, cliente: 1, compromiso: 1 })
    .lean();
  if (!pedidos.length) return;
  const ids = pedidos.map((p) => txt(p.idEnc)).filter(Boolean);
  const ya = new Set(
    (await compromisosLogModel.distinct("idEnc", { idEnc: { $in: ids } })).map(txt)
  );
  const faltan = pedidos.filter((p) => {
    if (ya.has(txt(p.idEnc))) return false;
    const estado = txt(p.compromiso?.estado).toLowerCase();
    return estado && estado !== "pendiente";
  });
  if (!faltan.length) return;
  await compromisosLogModel.insertMany(
    faltan.map((p) => ({
      idEnc: txt(p.idEnc),
      cliente: txt(p.cliente),
      usuario: txt(p.compromiso?.usuario),
      fecha: p.compromiso?.fecha,
      resultado: txt(p.compromiso?.estado || "error"),
      mensaje: txt(p.compromiso?.mensaje),
      filas: Number(p.compromiso?.filas || 0),
      faltantes: [],
      lineas: [],
      errores: erroresDeRespuesta(p.compromiso?.respuesta),
      payload: null,
      respuesta: p.compromiso?.respuesta || null,
      origen: "pedido",
    }))
  );
};

const docPesadoDe = (cargues, idEnc) => {
  const id = txt(idEnc);
  let mejor = null;
  for (const cargue of cargues || []) {
    for (const doc of cargue.documentos || []) {
      if (txt(doc.idEnc) !== id || esReapro(doc)) continue;
      const lineas = (doc.lineas || []).map(normalizarLineaPiso);
      const pesadas = lineas.filter((l) => !l.omitido && (num(l.cd) > 0 || num(l.pd) > 0));
      const candidato = { cargue, doc: { ...doc, lineas }, pesadas };
      if (!mejor || pesadas.length > mejor.pesadas.length) mejor = candidato;
    }
  }
  return mejor;
};

const armarFilasPedido = (pedido, hallado, itemsPorRef, idCia) => {
  const idEnc = txt(pedido.idEnc);
  if (!hallado || !hallado.pesadas.length) {
    return { filas: [], faltantes: ["No hay pesajes en piso para este pedido."] };
  }
  const siesaLineas = siesaPedidos.lineasDePedido(pedido);
  const porId = new Map(
    siesaLineas.map((linea, i) => [txt(linea.idDetenc || linea.idLinea), { linea, i }])
  );
  const porCodigo = new Map();
  siesaLineas.forEach((linea, i) => {
    const k = claveItem(linea.codigo);
    if (k && !porCodigo.has(k)) porCodigo.set(k, { linea, i });
  });

  const { co } = siesaPedidos.resolverBodegaPedido(pedido, siesaLineas);
  const tipoDocto = txt(pedido.tipoDocto || siesaLineas[0]?.tipoDocto);
  const bodega = txt(hallado.cargue?.bodega || hallado.doc?.bodega || pedido.bodega);
  const filas = [];
  const faltantes = [];

  hallado.pesadas.forEach((lineaPiso, idx) => {
    const match =
      porId.get(txt(lineaPiso.idLinea)) ||
      porCodigo.get(claveItem(lineaPiso.codigo || lineaPiso.referencia));
    const siesa = match?.linea || {};
    const nro = txt(siesa.idDetenc || lineaPiso.idLinea || siesa.nroRegistro || lineaPiso.nroRegistro);
    const referencia = txt(siesa.codigo || lineaPiso.codigo || lineaPiso.referencia);
    const item = itemsPorRef.get(claveItem(referencia));
    const unidad = txt(
      siesa.unidad ||
        lineaPiso.unidad ||
        (txt(lineaPiso.pedidoEn) === "KILOS" ? item?.undInventario : item?.undAdicional) ||
        item?.undInventario ||
        item?.undAdicional
    );
    const idItem = txt(siesa.idItem || item?.item);
    const fila = {
      F_CIA: idCia,
      f430_id_co: txt(co || pedido.co || siesa.co),
      f430_id_tipo_docto: txt(tipoDocto),
      f430_consec_docto: idEnc,
      f431_id_item: /^\d+$/.test(idItem) ? idItem.padStart(7, "0") : idItem,
      f431_referencia_item: referencia,
      f431_id_bodega: txt(siesa.bodega || bodega),
      f431_id_unidad_medida: unidad,
      f431_cant_base: qty(lineaPiso.pd),
      f431_cant_2: qty(lineaPiso.cd),
      f431_nro_registro: nro,
    };
    const faltaFila = [];
    if (!fila.f430_id_co) faltaFila.push("CO");
    if (!fila.f430_id_tipo_docto) faltaFila.push("tipo documento");
    if (!fila.f430_consec_docto) faltaFila.push("consecutivo");
    if (!fila.f431_referencia_item) faltaFila.push("referencia");
    if (!fila.f431_id_bodega) faltaFila.push("bodega");
    if (!fila.f431_id_unidad_medida) faltaFila.push("unidad de medida");
    if (!fila.f431_nro_registro) faltaFila.push("nro de registro");
    if (!(num(fila.f431_cant_base) > 0) && !(num(fila.f431_cant_2) > 0)) {
      faltaFila.push("cantidad despachada");
    }
    if (faltaFila.length) {
      faltantes.push(`Línea ${referencia || lineaPiso.idLinea || idx + 1}: falta ${faltaFila.join(", ")}.`);
      return;
    }
    filas.push(fila);
  });

  if (!filas.length && !faltantes.length) {
    faltantes.push("Ninguna línea pesada se pudo armar para SIESA.");
  }
  return { filas, faltantes };
};

const postConector = async (payload) => {
  const cfg = configCompromisos();
  if (!cfg.headers.ConniKey || !cfg.headers.ConniToken) {
    const err = new Error("Faltan SIESA_PEDIDOS_CONNI_KEY / SIESA_PEDIDOS_CONNI_TOKEN.");
    err.status = 500;
    throw err;
  }
  if (!cfg.idSistema) {
    const err = new Error("Configure SIESA_ID_SISTEMA (idSistema del conector).");
    err.status = 500;
    throw err;
  }
  console.log(`[compromisos-siesa] POST ${cfg.url} filas=${(payload.Compromisos || []).length}`);
  const timeoutMs = Number(process.env.SIESA_COMPROMISOS_TIMEOUT_MS || 120000);
  const response = await axios.post(cfg.url, payload, {
    headers: cfg.headers,
    timeout: timeoutMs,
    validateStatus: () => true,
  });
  const data = response.data;
  if (response.status >= 400 || !siesaOk(data)) {
    const err = new Error(mensajeSiesa(data, `SIESA respondió HTTP ${response.status}.`));
    err.status = response.status >= 500 ? 502 : 400;
    err.respuesta = data;
    throw err;
  }
  return data;
};

export const comprometerPedidosEnSiesa = async ({ ids, usuario }) => {
  const cfg = configCompromisos();
  const pedidos = await pedidosModel.find({ idEnc: { $in: ids } });
  const cargues = await carguesModel
    .find({ "documentos.idEnc": { $in: ids } })
    .sort({ fecha_actualizacion: -1 })
    .lean();
  const refs = [];
  for (const pedido of pedidos) {
    for (const linea of siesaPedidos.lineasDePedido(pedido)) {
      if (linea.codigo) refs.push(linea.codigo);
    }
  }
  const unicas = [...new Set(refs.map(txt).filter(Boolean))];
  const items = unicas.length
    ? await itemsModel
        .find(
          {
            $or: [
              { referencia: { $in: unicas } },
              { codigoItem: { $in: unicas } },
              { item: { $in: unicas } },
            ],
          },
          { item: 1, codigoItem: 1, referencia: 1, undInventario: 1, undAdicional: 1 }
        )
        .lean()
    : [];
  const itemsPorRef = indexarItems(items);

  const enviados = [];
  const fallidos = [];
  const ahora = new Date();

  for (const pedido of pedidos) {
    const idEnc = txt(pedido.idEnc);
    if (txt(pedido.estado).toLowerCase() !== "despachado") {
      const mensaje = "El pedido no está Despachado.";
      await guardarLog({
        idEnc,
        cliente: pedido.cliente,
        usuario,
        fecha: ahora,
        resultado: "omitido",
        mensaje,
        origen: "envio",
      });
      fallidos.push({ idEnc, mensaje });
      continue;
    }
    const hallado = docPesadoDe(cargues, idEnc);
    const { filas, faltantes } = armarFilasPedido(pedido, hallado, itemsPorRef, cfg.idCia);
    if (faltantes.length || !filas.length) {
      const mensaje = faltantes.join(" ") || "Estructura incompleta para SIESA.";
      pedido.compromiso = compromisoPedido({
        estado: "error",
        mensaje,
        usuario,
        fecha: ahora,
        filas: filas.length,
      });
      await pedido.save();
      await guardarLog({
        idEnc,
        cliente: pedido.cliente,
        usuario,
        fecha: ahora,
        resultado: "validacion",
        mensaje,
        filas: filas.length,
        faltantes,
        lineas: filas.map(lineaEnviada),
        payload: filas.length ? payloadSiesa(filas, cfg.idCia) : null,
      });
      fallidos.push({
        idEnc,
        mensaje,
        faltantes,
      });
      continue;
    }
    const payload = payloadSiesa(filas, cfg.idCia);
    const lineas = filas.map(lineaEnviada);
    try {
      const respuesta = await postConector(payload);
      const mensaje = mensajeSiesa(respuesta, "Enviado a SIESA.");
      pedido.estado = "Comprometido";
      pedido.compromiso = compromisoPedido({
        estado: "enviado",
        mensaje,
        usuario,
        fecha: ahora,
        filas: filas.length,
        respuesta,
      });
      await pedido.save();
      await guardarLog({
        idEnc,
        cliente: pedido.cliente,
        usuario,
        fecha: ahora,
        resultado: "enviado",
        mensaje,
        filas: filas.length,
        lineas,
        payload,
        respuesta,
      });
      enviados.push({ idEnc, filas: filas.length });
    } catch (error) {
      const mensaje = error.message || "No se pudo enviar a SIESA.";
      const respuesta = error.respuesta || null;
      pedido.compromiso = compromisoPedido({
        estado: "error",
        mensaje,
        usuario,
        fecha: ahora,
        filas: filas.length,
        respuesta,
      });
      await pedido.save();
      await guardarLog({
        idEnc,
        cliente: pedido.cliente,
        usuario,
        fecha: ahora,
        resultado: "error",
        mensaje,
        filas: filas.length,
        lineas,
        errores: erroresDeRespuesta(respuesta),
        payload,
        respuesta,
      });
      fallidos.push({ idEnc, mensaje, payload });
    }
  }

  const noHallados = ids.filter((id) => !pedidos.some((p) => txt(p.idEnc) === txt(id)));
  for (const idEnc of noHallados) {
    const mensaje = "Pedido no encontrado.";
    await guardarLog({
      idEnc,
      usuario,
      fecha: ahora,
      resultado: "omitido",
      mensaje,
    });
    fallidos.push({ idEnc, mensaje });
  }

  return {
    enviados,
    fallidos,
    consulta: cfg.url,
    idDocumento: cfg.idDocumento,
    nombreDocumento: cfg.nombreDocumento,
  };
};

export default {
  configCompromisos,
  comprometerPedidosEnSiesa,
  listarLogsCompromiso,
};
