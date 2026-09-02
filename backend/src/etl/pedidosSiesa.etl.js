import pedidosModel from "../models/pedidos.models";
import sincronizacionesModel from "../models/sincronizaciones.model";
import {
  agruparPorPedido,
  asegurarNoCancelado,
  cruzarPedidosConClientes,
  descargarClientesSiesa,
  descargarPedidosSiesa,
  indexarClientes,
  persistirStaging,
  rangoPorDefecto,
} from "../services/siesaPedidos.servicios";
import {
  estadoTrasEtl,
  restaurarEstadosDesdeCargues,
} from "../services/origenDespacho.servicios";

const fechaIso = (value) => {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const cargarPedidosDelRango = async (pedidos, { desde, hasta, ahora }) => {
  const idEncs = pedidos.map((pedido) => String(pedido.idEnc || "")).filter(Boolean);
  const previos = idEncs.length
    ? await pedidosModel
        .find({ idEnc: { $in: idEncs } }, { idEnc: 1, estado: 1, idCargue: 1, compromiso: 1 })
        .lean()
    : [];
  const porId = new Map(previos.map((pedido) => [String(pedido.idEnc), pedido]));

  await pedidosModel.deleteMany({
    fecha: { $gte: desde, $lte: hasta },
    ...(idEncs.length ? { idEnc: { $nin: idEncs } } : {}),
    estado: { $not: { $regex: /^(despachando|despachado|comprometido|cumplido)$/i } },
    $or: [{ idCargue: null }, { idCargue: { $exists: false } }],
  });

  if (!pedidos.length) {
    await restaurarEstadosDesdeCargues();
    return 0;
  }

  const docs = pedidos.map((pedido) => {
    const prev = porId.get(String(pedido.idEnc));
    const estadoSiesa = pedido.estado || "";
    const tras = estadoTrasEtl(prev, estadoSiesa);
    return {
      ...pedido,
      estadoSiesa,
      estado: tras.estado,
      idCargue: tras.idCargue,
      compromiso: tras.compromiso || undefined,
      fecha_sincronizacion: ahora,
    };
  });

  const lote = 500;
  for (let i = 0; i < docs.length; i += lote) {
    const chunk = docs.slice(i, i + lote);
    await pedidosModel.bulkWrite(
      chunk.map((pedido) => ({
        updateOne: {
          filter: { idEnc: pedido.idEnc },
          update: { $set: pedido },
          upsert: true,
        },
      }))
    );
  }
  await restaurarEstadosDesdeCargues();
  return pedidos.length;
};

export const ejecutarEtlPedidosSiesa = async ({
  usuario = "sistema",
  desde,
  hasta,
} = {}) => {
  const rango = rangoPorDefecto();
  let fechaDesde = fechaIso(desde) || rango.desde;
  let fechaHasta = fechaIso(hasta) || rango.hasta;
  if (fechaDesde > fechaHasta) {
    const tmp = fechaDesde;
    fechaDesde = fechaHasta;
    fechaHasta = tmp;
  }
  const ahora = new Date();

  console.log(`[etl:extract] pedidos ${fechaDesde}..${fechaHasta}`);
  asegurarNoCancelado();
  const descargaPedidos = await descargarPedidosSiesa({
    desde: fechaDesde,
    hasta: fechaHasta,
  });
  asegurarNoCancelado();

  const {
    consulta,
    filas,
    desde: fechaPedidos,
    hasta: fechaPedidosHasta,
    parametrosUsados,
    fechasEncontradas,
    fechasFueraDeRango,
    paginasLeidas,
    totalFilasSinFiltrar,
    aviso,
  } = descargaPedidos;

  if (filas.length === 0) {
    const extra = fechasFueraDeRango?.length
      ? ` SIESA trajo ${totalFilasSinFiltrar || fechasFueraDeRango.length} líneas del ${fechasFueraDeRango[0]} al ${fechasFueraDeRango[fechasFueraDeRango.length - 1]} (páginas ${paginasLeidas || "?"}). Si el tope es enero, Connekta paginó y faltan páginas; si el tope es anterior a Hasta, suba la fecha literal del SQL.`
      : paginasLeidas && paginasLeidas !== "0"
        ? ` Páginas leídas: ${paginasLeidas}.`
        : "";
    const error = new Error(
      `No hay pedidos del ${fechaPedidos} al ${fechaPedidosHasta}.${extra} Los pedidos locales no se borraron.`
    );
    error.status = 400;
    error.consulta = consulta;
    throw error;
  }

  asegurarNoCancelado();
  const lineasStaging = await persistirStaging(filas, {
    desde: fechaPedidos,
    hasta: fechaPedidosHasta,
    ahora,
  });
  console.log(`[etl:extract] ${filas.length} líneas, staging ${lineasStaging}`);

  asegurarNoCancelado();
  console.log("[etl:extract] clientes");
  const descargaClientes = await descargarClientesSiesa();
  if (!(descargaClientes.filas || []).length) {
    const error = new Error(
      `La consulta ${descargaClientes.consulta} no devolvió clientes con f200_id_cia=${descargaClientes.idCia}. Trajo ${descargaClientes.totalFilasSinFiltrar || 0} filas sin filtrar.`
    );
    error.status = 400;
    error.consulta = descargaClientes.consulta;
    throw error;
  }

  console.log("[etl:transform] agrupar y cruzar clientes");
  const pedidosSinCruzar = agruparPorPedido(filas);
  const indiceClientes = indexarClientes(descargaClientes.filas || []);
  const { pedidos, conCliente } = cruzarPedidosConClientes(
    pedidosSinCruzar,
    indiceClientes
  );
  console.log(
    `[etl:transform] ${pedidos.length} pedidos, ${conCliente} con VC`
  );

  asegurarNoCancelado();
  console.log(
    `[etl:load] reemplazar pedidos ${fechaPedidos}..${fechaPedidosHasta}`
  );
  const nuevos = await cargarPedidosDelRango(pedidos, {
    desde: fechaPedidos,
    hasta: fechaPedidosHasta,
    ahora,
  });

  await new sincronizacionesModel({
    nombre_sincronizacion: "pedidos",
    descripcion_sincronizacion: `ETL pedidos SIESA ${fechaPedidos} a ${fechaPedidosHasta} (${conCliente}/${pedidos.length} con cliente)`,
    estado_sincronizacion: "Finalizado",
    usuario_iniciador: usuario,
    total_items_nuevos: nuevos,
    total_actualizaciones: 0,
    fecha_sincronizacion: ahora,
  }).save();

  console.log(`[etl:load] ${nuevos} pedidos`);

  return {
    etl: true,
    consulta,
    desde: fechaPedidos,
    hasta: fechaPedidosHasta,
    parametrosUsados,
    fechasEncontradas,
    paginasLeidas,
    aviso: aviso || "",
    consultaClientes: descargaClientes.consulta,
    clientesCargados: descargaClientes.totalFilasSiesa,
    clientesIdCia: descargaClientes.idCia,
    paginasClientes: descargaClientes.paginasLeidas,
    pedidosConCliente: conCliente,
    totalFilasSiesa: filas.length,
    lineasStaging,
    totalPedidos: pedidos.length,
    nuevos,
    actualizados: 0,
  };
};

export default { ejecutarEtlPedidosSiesa };
