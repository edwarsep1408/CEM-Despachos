import { TIPOS_RECAUDO, bancoPorTipo, etiquetaTipoRecaudo } from "./recaudosRuta";

const MESES = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

const vacio = () => ({
  tipo: "OTRO",
  tipoEtiqueta: etiquetaTipoRecaudo("OTRO"),
  banco: "",
  monto: 0,
  fecha: "",
  referencia: "",
  recibo: "",
  aprobacion: "",
  convenio: "",
  codigoConvenio: "",
  terminal: "",
  codigoUnico: "",
  rrn: "",
  caja: "",
  lugar: "",
  oficina: "",
  pagador: "",
  nitPagador: "",
  beneficiario: "",
  nitBeneficiario: "",
  cuentaOrigen: "",
  cuentaDestino: "",
  costo: 0,
  formaPago: "",
  usuarioBanco: "",
  tipoId: "",
  numeroId: "",
  referencia2: "",
  placaTicket: "",
});

const compactar = (texto) =>
  String(texto || "")
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

const fold = (texto) =>
  compactar(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const lineasDe = (texto) =>
  String(texto || "")
    .split(/\r?\n/)
    .map((l) => compactar(l))
    .filter(Boolean);

export const parseCop = (valor) => {
  const s = String(valor || "").replace(/[^\d.,]/g, "");
  if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  const n = Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const montosEn = (texto) => {
  const re = /(?:cop\s*)?\$\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?|\d+(?:[.,]\d{2}))/gi;
  const out = [];
  let m;
  const src = String(texto || "");
  while ((m = re.exec(src))) {
    const n = parseCop(m[1]);
    if (n >= 1000) out.push(n);
  }
  return out;
};

const valorTrasEtiqueta = (texto, etiquetas) => {
  const lines = lineasDe(texto);
  for (let i = 0; i < lines.length; i += 1) {
    const f = fold(lines[i]);
    for (const et of etiquetas) {
      const e = fold(et);
      if (f === e || f === `${e}:`) {
        return compactar(lines[i + 1] || "");
      }
      const idx = f.indexOf(`${e}:`);
      if (idx >= 0) {
        const raw = lines[i].slice(lines[i].toLowerCase().indexOf(":") + 1);
        if (compactar(raw)) return compactar(raw);
        return compactar(lines[i + 1] || "");
      }
      if (f.startsWith(`${e} `) || f.startsWith(`${e}?`)) {
        const resto = compactar(lines[i].slice(et.length));
        if (resto && !/^[:?¿]+$/.test(resto)) return resto.replace(/^[:?¿\s]+/, "");
        return compactar(lines[i + 1] || "");
      }
    }
  }
  return "";
};

const extraerMonto = (texto, tipo) => {
  const etiquetas = {
    NEQUI: ["cuanto", "¿cuánto?", "cuánto?"],
    CORRESPONSAL: ["monto"],
    PAGO_PROVEEDORES: ["valor", "valor de la transaccion", "valor transaccion"],
    TRANSFERENCIA: ["valor de la transferencia", "valor"],
    RECAUDO_EMPRESARIAL: ["valor", "valor efectivo", "total"],
    OTRO: ["monto", "valor", "cuanto"],
  };
  const labeled = valorTrasEtiqueta(texto, etiquetas[tipo] || etiquetas.OTRO);
  const fromLabel = parseCop(labeled);
  if (fromLabel >= 1000) return fromLabel;
  const todos = montosEn(texto);
  if (!todos.length) return 0;
  return Math.max(...todos);
};

const pad2 = (n) => String(n).padStart(2, "0");

const aDatetimeLocal = (anio, mes, dia, hora = 0, min = 0) => {
  const y = Number(anio);
  const m = Number(mes);
  const d = Number(dia);
  if (!y || !m || !d) return "";
  return `${y}-${pad2(m)}-${pad2(d)}T${pad2(hora)}:${pad2(min)}`;
};

const extraerFecha = (texto) => {
  const src = compactar(texto);
  const labeled = valorTrasEtiqueta(texto, ["fecha", "fecha y hora"]);
  const candidato = labeled || src;

  let m = candidato.match(
    /\b(\d{1,2})\s*(?:de\s*)?([a-zA-Záéíóú]{3,})(?:\s*de)?\s*(\d{4})\s*(?:[-–aá]|a las)?\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i
  );
  if (m) {
    const mes = MESES[fold(m[2]).slice(0, 3)] || MESES[fold(m[2])];
    let hora = Number(m[4]);
    const min = Number(m[5]);
    const ampm = fold(m[7] || "");
    if (ampm.startsWith("p") && hora < 12) hora += 12;
    if (ampm.startsWith("a") && hora === 12) hora = 0;
    return aDatetimeLocal(m[3], mes, m[1], hora, min);
  }

  m = candidato.match(
    /\b([a-zA-Záéíóú]{3,})\s+(\d{1,2})\s+(\d{4})\s*[-–]?\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i
  );
  if (m) {
    const mes = MESES[fold(m[1]).slice(0, 3)] || MESES[fold(m[1])];
    let hora = Number(m[4]);
    const min = Number(m[5]);
    const ampm = fold(m[7] || "");
    if (ampm.startsWith("p") && hora < 12) hora += 12;
    if (ampm.startsWith("a") && hora === 12) hora = 0;
    return aDatetimeLocal(m[3], mes, m[2], hora, min);
  }

  m = candidato.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2})[:.](\d{2})/);
  if (m) return aDatetimeLocal(m[3], m[2], m[1], m[4], m[5]);

  return "";
};

const extraerPlaca = (texto) => {
  const m = String(texto || "").toUpperCase().match(/\b[A-Z]{3}\s*-?\s*\d{3}[A-Z]?\b/);
  return m ? m[0].replace(/[\s-]/g, "") : "";
};

const RE_CUENTA_BANCOLOMBIA = /\b(\d{3})\s*-\s*(\d{5,8})\s*-\s*(\d{2})\b/;
const RE_CUENTA_LARGA = /\b(\d{9,16})\b/;

const esEncabezadoSeccion = (linea) => {
  const f = fold(linea);
  return /^(producto origen|producto destino|informacion de la transaccion|datos de aprobacion|valor\b|referencia\b|convenio\b|monto\b|fecha\b|para\b|banco\b|numero de cuenta)/.test(
    f
  );
};

const cuentaEnLinea = (linea) => {
  const s = compactar(linea);
  if (!s || /\$|cop\s/i.test(s)) return "";
  const bc = s.match(RE_CUENTA_BANCOLOMBIA);
  if (bc) return `${bc[1]}-${bc[2]}-${bc[3]}`;
  const larga = s.match(RE_CUENTA_LARGA);
  if (larga) return larga[1];
  return "";
};

const tipoProductoEnLinea = (linea) => {
  const f = fold(linea);
  if (/corriente/.test(f)) return "Corriente";
  if (/ahorro/.test(f)) return "Ahorro";
  return "";
};

const lineaCoincideEtiqueta = (linea, etiquetas) => {
  const f = fold(linea);
  return etiquetas.some((et) => {
    const e = fold(et);
    return f === e || f === `${e}:` || f.startsWith(`${e} `) || f.startsWith(`${e}:`) || f.startsWith(`${e}?`);
  });
};

const extraerCuenta = (texto, etiquetas) => {
  const lines = lineasDe(texto);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lineaCoincideEtiqueta(lines[i], etiquetas)) continue;
    let tipoProd = "";
    let numero = cuentaEnLinea(lines[i]);
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j += 1) {
      if (esEncabezadoSeccion(lines[j]) && !lineaCoincideEtiqueta(lines[j], etiquetas)) break;
      if (!tipoProd) tipoProd = tipoProductoEnLinea(lines[j]);
      if (!numero) numero = cuentaEnLinea(lines[j]);
      if (numero && tipoProd) break;
    }
    if (numero) return tipoProd ? `${tipoProd} ${numero}` : numero;
  }
  return "";
};

export const detectarTipoComprobante = (texto) => {
  const t = fold(texto);
  const score = {
    NEQUI: 0,
    CORRESPONSAL: 0,
    PAGO_PROVEEDORES: 0,
    TRANSFERENCIA: 0,
    RECAUDO_EMPRESARIAL: 0,
  };
  if (/\bnequi\b/.test(t) || /envio a banco/.test(t) || /comprobante de pago/.test(t)) score.NEQUI += 6;
  if (/disponible/.test(t) && /banco/.test(t)) score.NEQUI += 2;
  if (/\bwompi\b/.test(t) || /corresponsal/.test(t)) score.CORRESPONSAL += 6;
  if (/recaudo de factura/.test(t) || /transaccion exitosa/.test(t)) score.CORRESPONSAL += 3;
  if (/\bcaja\b/.test(t) && /\brrn\b/.test(t)) score.CORRESPONSAL += 2;
  if (/pago a proveedores/.test(t) || /pago proveedores/.test(t)) score.PAGO_PROVEEDORES += 7;
  if (/recaudo empresarial/.test(t) || /\bdavivienda\b/.test(t)) score.RECAUDO_EMPRESARIAL += 6;
  if (/valor efectivo/.test(t) && /convenio/.test(t)) score.RECAUDO_EMPRESARIAL += 2;
  if (/transaccion aprobada/.test(t) || /producto origen/.test(t) || /producto destino/.test(t)) {
    score.TRANSFERENCIA += 6;
  }
  if (/valor de la transferencia/.test(t)) score.TRANSFERENCIA += 4;
  if (score.NEQUI >= 6) score.TRANSFERENCIA = Math.min(score.TRANSFERENCIA, 2);
  if (score.CORRESPONSAL >= 6) score.TRANSFERENCIA = Math.min(score.TRANSFERENCIA, 1);

  let tipo = "OTRO";
  let mejor = 2;
  for (const [codigo, pts] of Object.entries(score)) {
    if (pts > mejor) {
      mejor = pts;
      tipo = codigo;
    }
  }
  return tipo;
};

export const parsearTextoComprobante = (texto) => {
  const out = vacio();
  const raw = String(texto || "").trim();
  if (!raw) return out;
  const tipo = detectarTipoComprobante(raw);
  out.tipo = tipo;
  out.tipoEtiqueta = etiquetaTipoRecaudo(tipo);
  out.banco = bancoPorTipo(tipo);
  out.monto = extraerMonto(raw, tipo);
  out.fecha = extraerFecha(raw);
  out.referencia = valorTrasEtiqueta(raw, ["referencia", "ref"]);
  out.recibo = valorTrasEtiqueta(raw, [
    "recibo",
    "n° transaccion",
    "no. transaccion",
    "numero de transaccion",
    "no transaccion",
  ]);
  out.aprobacion = valorTrasEtiqueta(raw, ["aprob", "aprobacion", "codigo de aprobacion"]);
  out.rrn = valorTrasEtiqueta(raw, ["rrn"]);
  out.caja = valorTrasEtiqueta(raw, ["caja"]);
  out.convenio = valorTrasEtiqueta(raw, ["convenio", "nombre"]);
  out.codigoConvenio = valorTrasEtiqueta(raw, ["codigo convenio", "cod convenio", "codigo de convenio"]);
  out.terminal = valorTrasEtiqueta(raw, ["ter", "terminal"]);
  out.codigoUnico = valorTrasEtiqueta(raw, ["c. unico", "c unico", "codigo unico"]);
  out.lugar = valorTrasEtiqueta(raw, ["lugar", "oficina / lugar"]);
  out.oficina = valorTrasEtiqueta(raw, ["oficina"]);
  out.pagador = valorTrasEtiqueta(raw, ["pagador", "de", "origen"]);
  out.beneficiario = valorTrasEtiqueta(raw, ["para", "beneficiario", "a favor de"]);
  out.cuentaOrigen = extraerCuenta(raw, ["producto origen", "cuenta origen", "de donde salio la plata"]);
  out.cuentaDestino = extraerCuenta(raw, [
    "producto destino",
    "producto destino o producto a pagar",
    "cuenta destino",
    "numero de cuenta",
  ]);
  out.formaPago = valorTrasEtiqueta(raw, ["forma de pago", "tipo de recaudo"]);
  out.numeroId = valorTrasEtiqueta(raw, ["numero id", "cedula", "identificacion"]);
  out.tipoId = valorTrasEtiqueta(raw, ["tipo id", "tipo identificacion"]);
  out.placaTicket = extraerPlaca(raw);
  out.costo = parseCop(valorTrasEtiqueta(raw, ["costo"]));
  if (tipo === "NEQUI" && !out.banco) out.banco = "Nequi";
  if (tipo === "RECAUDO_EMPRESARIAL") out.banco = "Davivienda";
  if (out.referencia && out.referencia.length > 80) out.referencia = out.referencia.slice(0, 80);
  return out;
};
