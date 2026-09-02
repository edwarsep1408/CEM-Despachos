import pedidosModel from "../models/pedidos.models";
import sincronizacionesModel from "../models/sincronizaciones.model";
import { ejecutarEtlPedidosSiesa } from "../etl/pedidosSiesa.etl";
import siesaPedidos, {
  abortEtlPedidos,
  resetEtlAbort,
} from "../services/siesaPedidos.servicios";
import {
  comprometerPedidosEnSiesa,
  listarLogsCompromiso,
} from "../services/siesaCompromisos.servicios";
import {
  aplicarCargueAPedido,
  esLogistica,
  mapaCarguesActivos,
} from "../services/origenDespacho.servicios";

const pedidosCtr = {};

const fechaIso = (value) => {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

pedidosCtr.getPedidos = async (req, res) => {
  try {
    const desde = fechaIso(req.query.desde);
    const hasta = fechaIso(req.query.hasta);
    const filtro = {};
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = `${hasta}\uffff`;
    }

    const docs = await pedidosModel
      .find(filtro, { siesa: 0, lineas: 0 })
      .sort({ fecha: -1, idEnc: -1 })
      .lean();

    const enCargue = await mapaCarguesActivos();
    const body = docs.map((pedido) => {
      const { co, bodega } = siesaPedidos.resolverBodegaPedido(pedido, []);
      return aplicarCargueAPedido(
        {
          ...pedido,
          co: co || pedido.co || "",
          bodega: bodega || pedido.bodega || "",
          estado: pedido.estado || "",
          idCargue: pedido.idCargue || null,
        },
        enCargue.get(String(pedido.idEnc))
      );
    });

    return res.status(200).json({
      status: 200,
      consulta: siesaPedidos.configSiesa().consulta,
      total: body.length,
      body,
      error: false,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      body: { message: "No se pudieron leer los pedidos locales." },
      error: true,
    });
  }
};

pedidosCtr.getPedido = async (req, res) => {
  try {
    const pedido = await pedidosModel.findOne({ idEnc: req.params.idEnc }).lean();
    if (!pedido) {
      return res.status(404).json({
        status: 404,
        body: { message: "Pedido no encontrado." },
        error: true,
      });
    }
    const lineas = siesaPedidos.lineasDePedido(pedido);
    const { co, bodega } = siesaPedidos.resolverBodegaPedido(pedido, lineas);
    const crudo = Array.isArray(pedido.siesa) ? pedido.siesa[0] : {};
    const observacion =
      String(pedido.observacion || "").trim() ||
      (Array.isArray(pedido.siesa) && pedido.siesa.length
        ? String(siesaPedidos.agruparPorPedido(pedido.siesa)[0]?.observacion || "").trim()
        : "");
    const estadoSiesa =
      siesaPedidos.etiquetaEstado(crudo) ||
      pedido.estadoSiesa ||
      pedido.estado ||
      lineas[0]?.estado ||
      "";
    const enCargue = await mapaCarguesActivos();
    const conCargue = aplicarCargueAPedido(
      {
        ...pedido,
        observacion,
        bodega,
        co,
        estado: esLogistica(pedido.estado) ? pedido.estado : estadoSiesa,
        idCargue: pedido.idCargue || null,
        lineas,
      },
      enCargue.get(String(pedido.idEnc))
    );
    return res.status(200).json({
      status: 200,
      body: conCargue,
      error: false,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      body: { message: "No se pudo leer el pedido." },
      error: true,
    });
  }
};

const syncPedidosJob = {
  enCurso: false,
  desde: "",
  hasta: "",
  startedAt: null,
  ok: false,
  error: "Sincronización cancelada.",
  resultado: null,
};

setTimeout(() => {
  if (
    !syncPedidosJob.enCurso &&
    !syncPedidosJob.startedAt &&
    syncPedidosJob.error === "Sincronización cancelada."
  ) {
    syncPedidosJob.error = "";
  }
}, 120000);

const mensajeErrorEtl = (error) => {
  if (error?.cancelado) return "Sincronización cancelada.";
  const siesa = error.response?.data;
  const detalle =
    typeof siesa?.detalle === "string"
      ? siesa.detalle
      : typeof siesa?.mensaje === "string"
        ? siesa.mensaje
        : "";
  let mensaje =
    detalle ||
    error.message ||
    "No se pudieron sincronizar los pedidos con SIESA.";
  if (/converting date and\/or time from character string/i.test(mensaje)) {
    mensaje =
      "Connekta no pudo convertir una fecha en el SQL de Detalle_pedidos_ventas. Revise CONVERT/CAST en esa consulta.";
  } else if (/status code 5\d\d/i.test(mensaje)) {
    mensaje =
      "SIESA respondió error 500. La consulta de pedidos está sobrecargada; reduzca el rango de fechas.";
  }
  return mensaje;
};

pedidosCtr.sincronizarPedidosSiesa = async (req, res) => {
  const usuario = req.query.usuario;
  if (!usuario) {
    return res.status(400).json({
      status: 400,
      body: { message: "El usuario es obligatorio" },
      error: true,
    });
  }

  const desde = fechaIso(req.query.desde);
  const hasta = fechaIso(req.query.hasta);

  if (syncPedidosJob.enCurso) {
    return res.status(202).json({
      status: 202,
      body: {
        enCurso: true,
        message: "Ya hay una sincronización en curso.",
        desde: syncPedidosJob.desde,
        hasta: syncPedidosJob.hasta,
      },
      error: false,
    });
  }

  resetEtlAbort();
  syncPedidosJob.enCurso = true;
  syncPedidosJob.desde = desde;
  syncPedidosJob.hasta = hasta;
  syncPedidosJob.startedAt = new Date();
  syncPedidosJob.ok = false;
  syncPedidosJob.error = "";
  syncPedidosJob.resultado = null;

  res.status(202).json({
    status: 202,
    body: {
      enCurso: true,
      message: "Sincronización iniciada. El lote se guarda aunque tarde varios minutos.",
      desde,
      hasta,
    },
    error: false,
  });

  ejecutarEtlPedidosSiesa({ usuario, desde, hasta })
    .then((resultado) => {
      syncPedidosJob.enCurso = false;
      syncPedidosJob.ok = true;
      syncPedidosJob.error = "";
      syncPedidosJob.resultado = resultado;
      console.log(
        `[etl:pedidos] listo ${resultado.totalPedidos || 0} pedidos ${desde}..${hasta}`
      );
    })
    .catch((error) => {
      syncPedidosJob.enCurso = false;
      syncPedidosJob.ok = false;
      syncPedidosJob.error = mensajeErrorEtl(error);
      syncPedidosJob.resultado = null;
      if (error?.cancelado) {
        console.log("[etl:pedidos] cancelada");
        return;
      }
      console.error("[etl:pedidos] fallo", syncPedidosJob.error);
    });
};

pedidosCtr.cancelarSincronizacionPedidos = async (req, res) => {
  if (!syncPedidosJob.enCurso) {
    return res.status(200).json({
      status: 200,
      body: {
        enCurso: false,
        message: "No hay sincronización en curso.",
      },
      error: false,
    });
  }
  abortEtlPedidos();
  syncPedidosJob.enCurso = false;
  syncPedidosJob.ok = false;
  syncPedidosJob.error = "Sincronización cancelada.";
  syncPedidosJob.resultado = null;
  console.log("[etl:pedidos] cancelada por el usuario");
  return res.status(200).json({
    status: 200,
    body: {
      enCurso: false,
      cancelada: true,
      message: "Sincronización cancelada.",
    },
    error: false,
  });
};

pedidosCtr.informacionUltimaSincronizacion = async (req, res) => {
  try {
    const ultimaSincronizacion = await sincronizacionesModel
      .findOne({ nombre_sincronizacion: "pedidos" })
      .sort({ fecha_sincronizacion: -1 })
      .lean();

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      status: 200,
      body: {
        ...(ultimaSincronizacion || {}),
        enCurso: Boolean(syncPedidosJob.enCurso),
        syncDesde: syncPedidosJob.desde,
        syncHasta: syncPedidosJob.hasta,
        syncOk: syncPedidosJob.ok,
        syncError: syncPedidosJob.error,
        syncResultado: syncPedidosJob.resultado,
      },
      error: false,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      body: { message: "No se pudo consultar la última sincronización." },
      error: true,
    });
  }
};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 500) =>
  res.status(status).json({ status, body: { message }, error: true });

pedidosCtr.getPedidosCompromiso = async (req, res) => {
  try {
    const vista = String(req.query.estado || "despachado").trim().toLowerCase();
    const regex =
      vista === "comprometido"
        ? /^comprometido$/i
        : vista === "cumplido"
          ? /^cumplido$/i
          : /^despachado$/i;
    const filtro =
      vista === "cumplido"
        ? { $or: [{ estado: regex }, { estadoSiesa: regex }] }
        : { estado: regex };
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = desde;
      if (hasta) filtro.fecha.$lte = hasta;
    }
    const docs = await pedidosModel
      .find(filtro, { siesa: 0, lineas: 0 })
      .sort({ fecha: -1, idEnc: -1 })
      .lean();
    const enCargue = await mapaCarguesActivos();
    const body = docs.map((pedido) => {
      const { bodega } = siesaPedidos.resolverBodegaPedido(pedido, []);
      return aplicarCargueAPedido(
        {
          ...pedido,
          bodega: bodega || pedido.bodega || "",
        },
        enCargue.get(String(pedido.idEnc))
      );
    });
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer los pedidos para compromiso.");
  }
};

pedidosCtr.comprometerPedidos = async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!ids.length) return fail(res, "Seleccione al menos un pedido despachado.", 400);
    const identity = req.user?.identity || {};
    const usuario = String(identity.nombre || identity.usuario || "Administrador").trim();
    const resultado = await comprometerPedidosEnSiesa({ ids, usuario });
    const nOk = resultado.enviados.length;
    const nFail = resultado.fallidos.length;
    if (!nOk && nFail) {
      return fail(
        res,
        resultado.fallidos.map((f) => `${f.idEnc}: ${f.mensaje}`).join(" ") ||
          "Ningún pedido se pudo enviar a SIESA.",
        400
      );
    }
    return ok(res, {
      message:
        nFail > 0
          ? `Enviados ${nOk} pedido(s) a SIESA. ${nFail} no se pudieron enviar.`
          : `Enviados ${nOk} pedido(s) a SIESA.`,
      ...resultado,
    });
  } catch (error) {
    console.error("comprometerPedidos:", error.message);
    return fail(res, error.message || "No se pudieron comprometer los pedidos.", error.status || 500);
  }
};

pedidosCtr.getCompromisosLog = async (req, res) => {
  try {
    const idEnc = String(req.query.idEnc || req.query.pedido || "").trim();
    const desde = String(req.query.desde || "").slice(0, 10);
    const hasta = String(req.query.hasta || "").slice(0, 10);
    const body = await listarLogsCompromiso({ idEnc, desde, hasta });
    return ok(res, body);
  } catch (error) {
    console.error("getCompromisosLog:", error.message);
    return fail(res, "No se pudo leer el log de compromisos.");
  }
};

export default pedidosCtr;
