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

/**
 * Extrae cantidad embebida en campos de ancho fijo tipo
 * `000000000112.000` / `000000000112,000`.
 */
const cantidadFija = (texto) => {
  const t = String(texto || "");
  const m =
    t.match(/(\d{6,})[.,](\d{1,3})\b/) ||
    t.match(/\b(\d+)[.,](\d{1,3})\b/) ||
    t.match(/\b(\d{1,12})\b/);
  if (!m) return 0;
  if (m[2] != null) return numEdifact(`${m[1]}.${m[2]}`);
  return numEdifact(m[1]);
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
 *
 * Estructura típica (una línea = un segmento, CR/LF):
 *   UNB  <GLN proveedor>
 *   UNH  1
 *   BGM  220 | YB1          → tipo documento
 *   BGMA <nro orden>        → número de pedido cadena
 *   DTM  137 <fecha doc>    → fecha documento (YYYYMMDD…)
 *   DTM  63  <fecha hasta>  → entrega hasta
 *   DTM  64  <fecha desde>  → entrega desde
 *   FTX  …                  → textos legales / observaciones
 *   NAD  BY|SN|SG|SU|DP|IV|ITO <GLN>
 *   PAT / PATA … D <días>   → condición de pago
 *   LIN  <nro> <EAN|código> EN
 *   PIA  1 <código comprador> SA
 *   IMD  F <descripción>
 *   QTYA21 <cantidad> NAR|KGM   → cantidad pedida (madre / total línea)
 *   LOC  R7 <GLN tienda>        → hijo PDV (típico órdenes 0020… / YB1)
 *   QTYB11 <cantidad> …         → cantidad del hijo (reparto por tienda)
 *   PRI  AAB|AAA <precio>
 *   PAC  <empaques> <UM>
 *   CNT  2 <n líneas>
 *
 * Órdenes que empiezan por 0020 (BGM YB1): madre = CEDI (NAD DP/SN) + hijos = LOC R7.
 * Resto (BGM 220): pedido simple a un solo destino.
 *
 * Codificación habitual: latin1 / Windows-1252.
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
      delete lineaActual._locPendiente;
      if (!Array.isArray(lineaActual.hijos)) lineaActual.hijos = [];
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
      } else if (/^[A-Z]{2,3}\d*$/i.test(cuerpo) && cuerpo.length <= 6) {
        // p.ej. YB1 (variante Éxito) — no es el número de orden
        partes.tipoDoc = cuerpo.toUpperCase();
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
      const codigoCorto = resto.slice(10, 45).trim().split(/\s+/)[0] || "";
      lineaActual = {
        nroLinea: nro || String(partes.lineas.length + 1),
        ean: eanMatch ? eanMatch[1] : codigoCorto,
        codigoComprador: "",
        descripcion: "",
        cantidad: 0,
        unidad: "NAR",
        precio: 0,
        empaque: 0,
        unidadEmpaque: "",
        hijos: [],
        _locPendiente: "",
      };
      continue;
    }
    if (tag === "LOC" && lineaActual) {
      // `LOCR7   7701001004204                 9`
      const glnMatch = resto.match(/(\d{8,14})/);
      lineaActual._locPendiente = glnMatch ? glnMatch[1] : "";
      continue;
    }
    if (tag === "PIA" && lineaActual) {
      const nums = [...resto.matchAll(/(\d{4,})/g)].map((m) => m[1]);
      const codigo = nums.find((n) => n !== lineaActual.ean) || nums[0] || "";
      if (codigo) lineaActual.codigoComprador = codigo;
      continue;
    }
    if (tag === "IMD" && lineaActual) {
      // `IMD F                                 DESCRIPCION...`
      const desc = txt(resto.replace(/^\s*[A-Z]\s+/i, ""));
      if (desc) lineaActual.descripcion = desc;
      continue;
    }
    if (tag === "QTY" && lineaActual) {
      const calificador = txt(resto.slice(0, 3)).toUpperCase();
      // B11 = cantidad del hijo (LOC). No pisa el total A21 de la línea madre.
      if (calificador.startsWith("B")) {
        const cuerpo = resto.replace(/^B\d+\s*/i, "");
        const cantidad = cantidadFija(cuerpo);
        const und = (cuerpo.match(/\b([A-Z]{2,3})\s*$/i) || [])[1] || lineaActual.unidad || "NAR";
        const gln = lineaActual._locPendiente || "";
        if (gln && cantidad > 0) {
          lineaActual.hijos.push({
            gln,
            cantidad,
            unidad: und.toUpperCase(),
          });
        }
        lineaActual._locPendiente = "";
        continue;
      }
      if (calificador && calificador !== "A21" && !/^A\d+$/.test(calificador)) {
        continue;
      }
      const cuerpo = resto.replace(/^A\d+\s*/i, "");
      const cantidad = cantidadFija(cuerpo);
      const und = (cuerpo.match(/\b([A-Z]{2,3})\s*$/i) || [])[1] || "NAR";
      if (cantidad > 0) lineaActual.cantidad = cantidad;
      lineaActual.unidad = und.toUpperCase();
      continue;
    }
    if (tag === "PRI" && lineaActual) {
      const tipo = resto.slice(0, 4).trim().toUpperCase();
      const cuerpo = resto.slice(4);
      const precio = cantidadFija(cuerpo);
      if (tipo === "AAB" || tipo === "AAA" || !lineaActual.precio) {
        lineaActual.precio = precio;
      }
      continue;
    }
    if (tag === "PAC" && lineaActual) {
      const cantidad = cantidadFija(resto);
      const und = (resto.match(/\b([A-Z]{2,3})\b/) || [])[1] || "";
      if (cantidad > 0) lineaActual.empaque = cantidad;
      if (und) lineaActual.unidadEmpaque = und.toUpperCase();
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

  const glnsHijos = [];
  const vistos = new Set();
  for (const lin of partes.lineas) {
    for (const h of lin.hijos || []) {
      if (!h.gln || vistos.has(h.gln)) continue;
      vistos.add(h.gln);
      glnsHijos.push(h.gln);
    }
  }
  const prefijo0020 = String(partes.nroPedido || "").startsWith("0020");
  const tieneHijos = glnsHijos.length > 0;
  const glnCedi = partes.partes.DP || partes.partes.SN || partes.partes.ITO || "";

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
    // Madre (CEDI). En OC simple coincide con el único destino.
    glnEntrega: glnCedi || partes.partes.BY || "",
    glnCedi,
    glnFacturar: partes.partes.IV || partes.partes.BY || "",
    glnGrupo: partes.partes.SG || "",
    // Prefijo 0020 (YB1) = madre/hijos en la práctica; la fuente de verdad es LOC+QTYB.
    estructura: tieneHijos || prefijo0020 ? "madre-hijos" : "simple",
    tieneHijos,
    glnsHijos,
    partes: partes.partes,
    lineas: partes.lineas,
    archivoNombre: archivoNombre || "",
  };
};

export default { parsearHseOrdenes };
