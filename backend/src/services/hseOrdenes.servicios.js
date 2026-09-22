const txt = (valor) => String(valor ?? "").trim();

const fechaEdifact = (valor) => {
  const raw = txt(valor).replace(/\D/g, "");
  if (raw.length < 8) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

const numEdifact = (valor) => {
  const n = Number(String(valor || "").trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const partesLinea = (linea) => {
  const raw = String(linea || "").replace(/\r$/, "");
  if (!raw.trim()) return null;
  const tag = raw.slice(0, 3).toUpperCase();
  const resto = raw.slice(3);
  return { tag, resto, raw };
};

const rolNad = (resto) => {
  const t = txt(resto);
  const m = t.match(/^([A-Z]{2,3})\s+(.+)$/i);
  if (!m) return { rol: "", gln: "" };
  return { rol: m[1].toUpperCase(), gln: txt(m[2]).split(/\s+/)[0] };
};

/**
 * Parser de ORDERS estilo EDIFACT / .hse (cadenas retail Colombia).
 * Formato de ancho/espacios fijo observado en archivos .hse.
 */
export const parsearHseOrdenes = (contenido, { archivoNombre = "" } = {}) => {
  const lineas = String(contenido || "").split(/\r?\n/);
  const partes = {
    unb: "",
    nroPedido: "",
    tipoDoc: "",
    fechaDocumento: "",
    fechaEntregaDesde: "",
    fechaEntregaHasta: "",
    textoLibre: [],
    partes: {},
    pagoDias: null,
    lineas: [],
  };

  let lineaActual = null;

  const flushLinea = () => {
    if (!lineaActual) return;
    if (lineaActual.ean || lineaActual.codigoComprador) {
      partes.lineas.push(lineaActual);
    }
    lineaActual = null;
  };

  for (const linea of lineas) {
    const seg = partesLinea(linea);
    if (!seg) continue;
    const { tag, resto } = seg;

    if (tag === "UNB") {
      partes.unb = txt(resto);
      continue;
    }
    if (tag === "BGM") {
      const cuerpo = resto.trim();
      if (/^\d+$/.test(cuerpo)) {
        partes.tipoDoc = cuerpo;
      } else if (cuerpo.startsWith("A") || cuerpo.length > 3) {
        partes.nroPedido = txt(cuerpo.replace(/^A/i, ""));
      }
      continue;
    }
    if (tag === "DTM") {
      const codigo = resto.slice(0, 4).trim();
      const fecha = fechaEdifact(resto.slice(4, 20));
      if (codigo === "137") partes.fechaDocumento = fecha;
      else if (codigo === "63") partes.fechaEntregaHasta = fecha;
      else if (codigo === "64") partes.fechaEntregaDesde = fecha;
      continue;
    }
    if (tag === "FTX") {
      const texto = txt(resto.replace(/^A/i, ""));
      if (texto && texto !== "PUR") partes.textoLibre.push(texto);
      continue;
    }
    if (tag === "NAD") {
      const { rol, gln } = rolNad(resto);
      if (rol && gln) partes.partes[rol] = gln;
      continue;
    }
    if (tag === "PAT") {
      const match = resto.match(/D\s+(\d+)/i) || resto.match(/\b(\d+)\s*$/);
      if (match) partes.pagoDias = Number(match[1]) || null;
      continue;
    }
    if (tag === "LIN") {
      flushLinea();
      const nro = resto.slice(0, 10).trim();
      const eanMatch = resto.match(/(\d{8,14})/);
      lineaActual = {
        nroLinea: nro || String(partes.lineas.length + 1),
        ean: eanMatch ? eanMatch[1] : resto.slice(10, 45).trim(),
        codigoComprador: "",
        cantidad: 0,
        unidad: "NAR",
        precio: 0,
        empaque: 0,
      };
      continue;
    }
    if (tag === "PIA" && lineaActual) {
      const nums = [...resto.matchAll(/(\d{4,})/g)].map((m) => m[1]);
      const codigo = nums.find((n) => n !== lineaActual.ean) || nums[0] || "";
      if (codigo) lineaActual.codigoComprador = codigo;
      continue;
    }
    if (tag === "QTY" && lineaActual) {
      const cuerpo = resto.replace(/^A\d+\s*/i, "");
      const m = cuerpo.match(/([\d]+[.,][\d]+|[\d]+)/);
      const und = (cuerpo.match(/\b([A-Z]{2,3})\s*$/i) || [])[1] || "NAR";
      if (m) lineaActual.cantidad = numEdifact(m[1]);
      lineaActual.unidad = und.toUpperCase();
      continue;
    }
    if (tag === "PRI" && lineaActual) {
      const tipo = resto.slice(0, 4).trim().toUpperCase();
      const cuerpo = resto.slice(4);
      const m = cuerpo.match(/([\d]+[.,][\d]+|[\d]+)/);
      const precio = m ? numEdifact(m[1]) : 0;
      if (tipo === "AAB" || tipo === "AAA" || !lineaActual.precio) {
        lineaActual.precio = precio;
      }
      continue;
    }
    if (tag === "PAC" && lineaActual) {
      const m = resto.match(/([\d]+[.,][\d]+|[\d]+)/);
      if (m) lineaActual.empaque = numEdifact(m[1]);
      continue;
    }
  }
  flushLinea();

  if (!partes.nroPedido) {
    const desdeNombre = String(archivoNombre || "").replace(/\.hse$/i, "").trim();
    if (desdeNombre) partes.nroPedido = desdeNombre;
  }

  if (!partes.nroPedido) {
    throw new Error("El archivo .hse no trae número de orden (BGM).");
  }
  if (!partes.lineas.length) {
    throw new Error("El archivo .hse no trae líneas de producto (LIN).");
  }

  return {
    nroPedido: partes.nroPedido,
    tipoDoc: partes.tipoDoc || "220",
    fecha: partes.fechaDocumento || partes.fechaEntregaDesde || "",
    fechaEntregaDesde: partes.fechaEntregaDesde || "",
    fechaEntregaHasta: partes.fechaEntregaHasta || "",
    observacion: partes.textoLibre.join(" · "),
    pagoDias: partes.pagoDias,
    glnProveedor: partes.partes.SU || partes.unb || "",
    glnComprador: partes.partes.BY || "",
    glnEntrega: partes.partes.DP || partes.partes.SN || partes.partes.ITO || "",
    glnFacturar: partes.partes.IV || partes.partes.BY || "",
    glnGrupo: partes.partes.SG || "",
    partes: partes.partes,
    lineas: partes.lineas,
    archivoNombre: archivoNombre || "",
  };
};

export default { parsearHseOrdenes };
