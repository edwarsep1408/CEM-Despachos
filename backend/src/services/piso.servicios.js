const num = (valor) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const temperaturaUnDecimal = (valor) => {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
};

const normalizarPesaje = (p = {}) => ({
  idPesaje: String(p.idPesaje || ""),
  unidades: num(p.unidades) || 1,
  peso: num(p.peso),
  tara: num(p.tara),
  taraDetalle: p.taraDetalle && typeof p.taraDetalle === "object" ? p.taraDetalle : {},
  lote: String(p.lote ?? "0"),
  temperatura: temperaturaUnDecimal(p.temperatura) || "",
  fechaVencimiento: String(p.fechaVencimiento || ""),
  pNeto: Number(num(p.pNeto).toFixed(3)),
  fecha: p.fecha || new Date().toISOString(),
});

const recalcularAcumulados = (linea) => {
  const pesajes = Array.isArray(linea.pesajes) ? linea.pesajes : [];
  const cd = pesajes.reduce((acc, p) => acc + num(p.unidades), 0);
  const pd = pesajes.reduce((acc, p) => acc + num(p.pNeto), 0);
  const unidades = num(linea.unidades);
  const pesoPedido = num(linea.pesoPedido ?? linea.kilo);
  let estado = "PEND";
  if (linea.omitido) estado = "OMIT";
  else if ((unidades > 0 && cd >= unidades) || (pesoPedido > 0 && pd >= pesoPedido && cd > 0)) {
    estado = "DESP";
  } else if (cd > 0 || pd > 0) {
    estado = "PEND";
  }
  return {
    ...linea,
    cd: Number(cd.toFixed(3)),
    pd: Number(pd.toFixed(3)),
    estadoDespacho: estado,
  };
};

const unidadPedidoDe = (linea = {}) => {
  const um = String(linea.unidad || linea.undInventario || linea.um || linea.pedidoEn || "")
    .trim()
    .toUpperCase();
  if (um.includes("KG") || um.includes("KILO")) return "KILOS";
  if (um.includes("UND") || um.includes("UNID")) return "UNIDADES";
  const und = num(linea.unidades ?? linea.cant1);
  const kg = num(linea.pesoPedido ?? linea.kilo ?? linea.cant2);
  if (kg > 0 && !(und > 0)) return "KILOS";
  return "UNIDADES";
};

const normalizarLineaPiso = (linea = {}, i = 0) => {
  const pesajes = Array.isArray(linea.pesajes) ? linea.pesajes.map(normalizarPesaje) : [];
  const unidades = num(linea.unidades ?? linea.cant1);
  const pesoPedido = num(linea.pesoPedido ?? linea.kilo ?? linea.kilos ?? linea.cant2);
  const unidad = String(linea.unidad || linea.undInventario || linea.um || "").trim();
  return recalcularAcumulados({
    idLinea: String(linea.idLinea || linea.idDetenc || linea._id || `L${i + 1}`),
    nroRegistro: String(linea.nroRegistro || i + 1).trim(),
    oc: String(linea.oc || ""),
    codigo: String(linea.codigo || linea.referencia || linea.codigoItem || "").trim(),
    producto: String(linea.producto || linea.descripcion || "").trim(),
    referencia: String(linea.referencia || linea.codigo || linea.codigoItem || "").trim(),
    descripcion: String(linea.descripcion || linea.producto || "").trim(),
    unidades,
    pesoPedido,
    kilo: pesoPedido,
    cant1: unidades,
    cant2: pesoPedido,
    unidad,
    undInventario: String(linea.undInventario || "").trim(),
    idItem: String(linea.idItem || linea.item || "").trim(),
    pedidoEn: unidadPedidoDe({ ...linea, unidades, pesoPedido, unidad }),
    omitido: !!linea.omitido,
    motivoOmision: String(linea.motivoOmision || ""),
    pesajes,
    cd: linea.cd,
    pd: linea.pd,
    vidaUtilMeses: Number(linea.vidaUtilMeses) || 0,
    vidaUtilDias: Number(linea.vidaUtilDias) || 0,
    vidaUtilEtiqueta: String(linea.vidaUtilEtiqueta || ""),
    unidadesEmpaque: Number(linea.unidadesEmpaque) || 0,
    unidadesEmpaqueMax: Number(linea.unidadesEmpaqueMax) || 0,
    taraNombre: String(linea.taraNombre || "").trim(),
    estadoFrio: String(linea.estadoFrio || "").trim(),
  });
};

const etiquetaTipoDoc = (doc = {}) => {
  const tipo = String(doc.tipo || "").toUpperCase();
  const tipoDoc = String(doc.tipoDoc || "").trim();
  if (tipo === "REAPRO" || /reapro/i.test(tipoDoc)) return "REAPROVISIONAMIENTO";
  if (/pedido/i.test(tipoDoc) || tipo === "PEDIDO") return "PEDIDO";
  const limpio = String(tipoDoc || tipo || "DOCUMENTO").replace(/\s*iventas\s*/gi, "").trim();
  return limpio || "DOCUMENTO";
};

const hayLineasUtiles = (lineas) =>
  (Array.isArray(lineas) ? lineas : []).some(
    (l) => l && (l.codigo || l.producto || l.referencia || l.descripcion)
  );

const progresoCargue = (cargue, { conLineas } = {}) => {
  const documentos = [];
  let docsOmit = 0;
  let docsDesp = 0;
  let docsProc = 0;
  let docsPend = 0;
  let lineasPend = 0;
  let lineasDesp = 0;
  let lineasOmit = 0;
  let lineasProc = 0;
  let pesoPedido = 0;
  let pesoDesp = 0;
  let undPedido = 0;
  let undDesp = 0;

  for (const doc of cargue.documentos || []) {
    const lineas = (doc.lineas || []).map(normalizarLineaPiso);
    for (const l of lineas) {
      pesoPedido += num(l.pesoPedido);
      pesoDesp += num(l.pd);
      undPedido += num(l.unidades);
      undDesp += num(l.cd);
      if (l.omitido || l.estadoDespacho === "OMIT") lineasOmit += 1;
      else if (l.estadoDespacho === "DESP") lineasDesp += 1;
      else if (num(l.cd) > 0 || num(l.pd) > 0) lineasProc += 1;
      else lineasPend += 1;
    }
    let estadoDoc = "PEND";
    if (doc.omitido || doc.estadoDespacho === "OMIT") {
      estadoDoc = "OMIT";
      docsOmit += 1;
    } else if (!lineas.length) {
      estadoDoc = doc.estadoDespacho === "DESP" ? "DESP" : "PEND";
      if (estadoDoc === "DESP") docsDesp += 1;
      else docsPend += 1;
    } else {
      const activas = lineas.filter((l) => !l.omitido && l.estadoDespacho !== "OMIT");
      const listas = !activas.length || activas.every((l) => l.estadoDespacho === "DESP");
      const alguna = lineas.some(
        (l) => num(l.cd) > 0 || num(l.pd) > 0 || l.estadoDespacho === "DESP"
      );
      if (listas) {
        estadoDoc = "DESP";
        docsDesp += 1;
      } else if (alguna) {
        estadoDoc = "PROCESO";
        docsProc += 1;
      } else {
        estadoDoc = "PEND";
        docsPend += 1;
      }
    }
    const item = {
      _id: String(doc._id),
      tipoDoc: etiquetaTipoDoc(doc),
      tipoDocto: doc.tipoDocto || "",
      idEnc: doc.idEnc,
      nroDoc: doc.nroDoc,
      observacion: doc.observacion || "",
      cliente: doc.cliente,
      sucursal: doc.sucursal,
      omitido: !!doc.omitido,
      motivoOmision: doc.motivoOmision || "",
      estado: estadoDoc,
      totalLineas: lineas.length,
    };
    if (conLineas) {
      item.lineas = lineas.map((l) => ({
        idLinea: l.idLinea,
        codigo: l.codigo,
        producto: l.producto,
        estado: l.estadoDespacho,
        unidades: l.unidades,
        pesoPedido: l.pesoPedido,
        pedidoEn: l.pedidoEn,
        unidad: l.unidad,
        cd: l.cd,
        pd: l.pd,
        omitido: l.omitido,
        motivoOmision: l.motivoOmision,
      }));
    }
    documentos.push(item);
  }

  const lineasActivas = lineasPend + lineasDesp + lineasProc;
  const avance = lineasActivas
    ? Math.round((lineasDesp / lineasActivas) * 100)
    : documentos.length
      ? Math.round(((docsDesp + docsOmit) / documentos.length) * 100)
      : 0;

  let estado = "EN_PISO";
  if (cargue.estado === "pendiente") estado = "ARMADO";
  else if (cargue.reabiertoDespacho) estado = "EN_PROCESO";
  else if (documentos.length && docsPend === 0 && docsProc === 0) estado = "COMPLETADO";
  else if (docsProc > 0 || lineasDesp > 0 || lineasProc > 0) estado = "EN_PROCESO";

  return {
    _id: String(cargue._id),
    idCargue: cargue.idCargue,
    despachador: cargue.despachadorUsuario || cargue.despachadorNombre,
    despachadorNombre: cargue.despachadorNombre,
    bodega: cargue.bodega,
    bodegaNombre: cargue.bodegaNombre,
    estadoCargue: cargue.estado,
    estado,
    fecha_envio: cargue.fecha_envio,
    fecha_actualizacion: cargue.fecha_actualizacion,
    totalDocumentos: documentos.length,
    docsPend,
    docsProc,
    docsDesp,
    docsOmit,
    lineasPend,
    lineasProc,
    lineasDesp,
    lineasOmit,
    avance,
    pesoPedido: Number(pesoPedido.toFixed(2)),
    pesoDesp: Number(pesoDesp.toFixed(2)),
    undPedido: Number(undPedido.toFixed(2)),
    undDesp: Number(undDesp.toFixed(2)),
    documentos: conLineas ? documentos : undefined,
  };
};

export {
  num,
  temperaturaUnDecimal,
  normalizarPesaje,
  normalizarLineaPiso,
  recalcularAcumulados,
  etiquetaTipoDoc,
  hayLineasUtiles,
  progresoCargue,
};
