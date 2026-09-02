import net from "net";

const sesiones = new Map();

const room = (id) => `bascula:${id}`;

const emitir = (id, evento, payload) => {
  if (!global.io) return;
  global.io.to(room(id)).emit(evento, { id, ...payload });
};

const mensajeConexion = (error) => {
  const codigo = error?.code || "";
  if (codigo === "ECONNREFUSED") {
    return "El puerto rechazó la conexión. Confirme el puerto TCP y que no haya otro cliente usando el convertidor.";
  }
  if (codigo === "ETIMEDOUT" || codigo === "EHOSTUNREACH" || codigo === "ENETUNREACH") {
    return "No se alcanzó la IP. Este servidor debe estar en la misma red local que el convertidor.";
  }
  if (codigo === "ECONNRESET") return "El convertidor cerró la conexión.";
  return error?.message || "No se pudo conectar con la báscula.";
};

const aHex = (buffer) =>
  Buffer.from(buffer)
    .toString("hex")
    .replace(/(..)/g, "$1 ")
    .trim();

const aTexto = (buffer) =>
  Buffer.from(buffer)
    .toString("latin1")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");

const IAC = 0xff;
const SB = 0xfa;
const SE = 0xf0;

const quitarTelnetRfc2217 = (buffer) => {
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

const PESO_RE = /=\s*(-?\d+(?:\.\d+)?)/;
const CONTINUO_RE = /=\s*(-?\d+(?:\.\d+)?)(?==)/g;
const MAX_RESTANTE = 4096;

const parsearPeso = (trama) => {
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

const extraerTramas = (sesion, chunk) => {
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

export const detener = (id) => {
  const sesion = sesiones.get(String(id));
  if (!sesion) return false;
  sesiones.delete(String(id));
  try {
    sesion.socket.removeAllListeners();
    sesion.socket.destroy();
  } catch (_error) {
    /* ignore */
  }
  emitir(id, "bascula-estado", { conectado: false });
  return true;
};

export const enviar = (id, payload, { crlf } = {}) => {
  const sesion = sesiones.get(String(id));
  if (!sesion?.socket || sesion.socket.destroyed) {
    throw new Error("No hay una escucha activa con esa báscula.");
  }
  let datos = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload ?? ""), "latin1");
  if (crlf === "cr") datos = Buffer.concat([datos, Buffer.from("\r")]);
  if (crlf === "lf") datos = Buffer.concat([datos, Buffer.from("\n")]);
  if (crlf === "crlf") datos = Buffer.concat([datos, Buffer.from("\r\n")]);
  sesion.socket.write(datos);
  return datos.length;
};

export const escuchar = ({ id, ip, puerto }) => {
  const clave = String(id);
  detener(clave);
  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: ip,
      port: Number(puerto),
    });
    socket.setKeepAlive(true, 10000);
    socket.setTimeout(8000);
    let abierto = false;

    socket.once("connect", () => {
      abierto = true;
      socket.setTimeout(0);
      sesiones.set(clave, { socket, ip, puerto, desde: Date.now(), restante: Buffer.alloc(0) });
      emitir(clave, "bascula-estado", { conectado: true, ip, puerto });
      resolve({ ip, puerto });
    });

    socket.on("data", (chunk) => {
      const sesion = sesiones.get(clave);
      if (!sesion) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const serial = quitarTelnetRfc2217(buffer);
      if (!serial.length) return;
      const tramas = extraerTramas(sesion, serial);
      const ts = Date.now();
      tramas.forEach((item) => {
        emitir(clave, "bascula-dato", {
          ts,
          texto: item.peso != null ? String(item.peso) : item.trama,
          trama: item.trama,
          peso: item.peso,
          hex: item.hex,
          bytes: item.bytes,
        });
      });
    });

    socket.on("timeout", () => {
      if (!abierto) {
        socket.destroy();
        reject(new Error("Tiempo de espera agotado al conectar con la báscula."));
      }
    });

    socket.on("error", (error) => {
      const mensaje = mensajeConexion(error);
      emitir(clave, "bascula-estado", { conectado: false, error: mensaje });
      if (!abierto) reject(new Error(mensaje));
    });

    socket.on("close", () => {
      if (sesiones.get(clave)?.socket === socket) {
        sesiones.delete(clave);
      }
      emitir(clave, "bascula-estado", { conectado: false });
    });
  });
};

export const haySesion = (id) => sesiones.has(String(id));

export const detenerSiSalaVacia = (id) => {
  if (!global.io) return;
  const sala = global.io.sockets.adapter.rooms.get(room(id));
  if (!sala || sala.size === 0) detener(id);
};
