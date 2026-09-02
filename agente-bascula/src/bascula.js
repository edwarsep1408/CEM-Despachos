import net from "net";
import { extraerTramas, quitarTelnetRfc2217 } from "./protocolo.js";

const mensajeConexion = (error) => {
  const codigo = error?.code || "";
  if (codigo === "ECONNREFUSED") {
    return "El puerto rechazó la conexión. Confirme IP/puerto y que no haya otro cliente en el convertidor.";
  }
  if (codigo === "ETIMEDOUT" || codigo === "EHOSTUNREACH" || codigo === "ENETUNREACH") {
    return "No se alcanzó la báscula. Este PC debe estar en la misma red que el convertidor.";
  }
  if (codigo === "ECONNRESET") return "El convertidor cerró la conexión.";
  return error?.message || "No se pudo conectar con la báscula.";
};

export const crearBascula = ({ ip, puerto, onCambio }) => {
  const estado = {
    ip,
    puerto: Number(puerto),
    conectado: false,
    reconectando: false,
    error: null,
    peso: null,
    trama: null,
    hex: null,
    ts: null,
  };
  let socket = null;
  let restante = Buffer.alloc(0);
  let timer = null;
  let cerrado = false;

  const avisar = () => onCambio?.({ ...estado });

  const limpiarSocket = () => {
    if (!socket) return;
    try {
      socket.removeAllListeners();
      socket.destroy();
    } catch (_error) {
      /* ignore */
    }
    socket = null;
  };

  const programarReintento = () => {
    if (cerrado || timer) return;
    estado.reconectando = true;
    avisar();
    timer = setTimeout(() => {
      timer = null;
      conectar();
    }, 3000);
  };

  const conectar = () => {
    if (cerrado) return;
    limpiarSocket();
    restante = Buffer.alloc(0);
    estado.conectado = false;
    avisar();

    const actual = net.connect({ host: estado.ip, port: estado.puerto });
    socket = actual;
    actual.setKeepAlive(true, 10000);
    actual.setTimeout(8000);

    actual.once("connect", () => {
      actual.setTimeout(0);
      estado.conectado = true;
      estado.reconectando = false;
      estado.error = null;
      avisar();
    });

    actual.on("data", (chunk) => {
      const serial = quitarTelnetRfc2217(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (!serial.length) return;
      const sesion = { restante };
      const tramas = extraerTramas(sesion, serial);
      restante = sesion.restante;
      tramas.forEach((item) => {
        if (typeof item.peso === "number" && Number.isFinite(item.peso)) {
          estado.peso = item.peso;
        }
        estado.trama = item.trama;
        estado.hex = item.hex;
        estado.ts = Date.now();
        avisar();
      });
    });

    actual.on("timeout", () => {
      if (!estado.conectado) actual.destroy();
    });

    actual.on("error", (error) => {
      estado.error = mensajeConexion(error);
      estado.conectado = false;
      avisar();
    });

    actual.on("close", () => {
      if (socket === actual) socket = null;
      estado.conectado = false;
      if (!cerrado) programarReintento();
      else avisar();
    });
  };

  return {
    estado: () => ({ ...estado }),
    conectar,
    detener() {
      cerrado = true;
      if (timer) clearTimeout(timer);
      timer = null;
      limpiarSocket();
      estado.conectado = false;
      estado.reconectando = false;
      avisar();
    },
  };
};
