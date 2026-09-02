const IAC = 0xff;
const SB = 0xfa;
const SE = 0xf0;
const PESO_RE = /=\s*(-?\d+(?:\.\d+)?)/;
const CONTINUO_RE = /=\s*(-?\d+(?:\.\d+)?)(?==)/g;
const MAX_RESTANTE = 4096;

export const aHex = (buffer) =>
  Buffer.from(buffer)
    .toString("hex")
    .replace(/(..)/g, "$1 ")
    .trim();

export const aTexto = (buffer) =>
  Buffer.from(buffer)
    .toString("latin1")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");

export const quitarTelnetRfc2217 = (buffer) => {
  const out = [];
  for (let i = 0; i < buffer.length; i += 1) {
    const b = buffer[i];
    if (b !== IAC) {
      out.push(b);
      continue;
    }
    const cmd = buffer[i + 1];
    if (cmd === IAC) {
      out.push(IAC);
      i += 1;
      continue;
    }
    if (cmd === SB) {
      i += 2;
      while (i < buffer.length && !(buffer[i] === IAC && buffer[i + 1] === SE)) i += 1;
      i += 1;
      continue;
    }
    i += 2;
  }
  return Buffer.from(out);
};

export const parsearPeso = (trama) => {
  const m = String(trama || "").match(PESO_RE);
  return m ? Number(m[1]) : null;
};

const itemTrama = (trama, peso) => {
  const valor = peso ?? parsearPeso(trama);
  return {
    trama,
    peso: valor,
    hex: aHex(Buffer.from(trama, "latin1")),
    bytes: Buffer.byteLength(trama, "latin1"),
  };
};

export const extraerTramas = (sesion, chunk) => {
  sesion.restante = Buffer.concat([sesion.restante || Buffer.alloc(0), chunk]);
  let texto = sesion.restante.toString("latin1").replace(/\0/g, "");
  const items = [];

  const lineas = texto.split(/\r\n|\n|\r/);
  texto = lineas.pop() ?? "";
  for (const linea of lineas) {
    const trama = linea.trim();
    if (trama) items.push(itemTrama(trama));
  }

  CONTINUO_RE.lastIndex = 0;
  let m;
  let lastEnd = 0;
  while ((m = CONTINUO_RE.exec(texto)) !== null) {
    items.push(itemTrama(m[0], Number(m[1])));
    lastEnd = m.index + m[0].length;
  }
  texto = texto.slice(lastEnd);

  const cola = texto.match(/^=\s*(-?\d+\.\d+)\s*$/);
  if (cola) {
    items.push(itemTrama(cola[0].trim(), Number(cola[1])));
    texto = "";
  }

  sesion.restante = Buffer.from(texto, "latin1");
  if (sesion.restante.length > MAX_RESTANTE) {
    const crudo = sesion.restante;
    sesion.restante = Buffer.alloc(0);
    const ascii = crudo.includes(0x3d);
    items.push({
      trama: ascii
        ? aTexto(crudo)
        : `Sin trama de peso (${crudo.length} bytes binarios). No es =peso. Revise UART 9600 8-N-1, el cable RS232 y que la báscula esté transmitiendo.`,
      peso: ascii ? parsearPeso(aTexto(crudo)) : null,
      hex: aHex(crudo.subarray(0, 48)) + (crudo.length > 48 ? " …" : ""),
      bytes: crudo.length,
    });
  }

  if (!items.length) return [];
  const conPeso = items.filter((item) => item.peso != null);
  return conPeso.length ? [conPeso[conPeso.length - 1]] : [items[items.length - 1]];
};
