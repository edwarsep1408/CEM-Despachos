import net from "net";

const txt = (v) => String(v ?? "").trim();

export const configImpresora = () => ({
  ip: txt(process.env.TSC_IMPRESORA_IP) || "192.168.1.35",
  puerto: Number(process.env.TSC_IMPRESORA_PUERTO) || 9100,
  timeoutMs: Number(process.env.TSC_IMPRESORA_TIMEOUT_MS) || 8000,
});

/** Envía TSPL crudo a la TSC MH241T en la LAN del muelle. */
export const enviarTspl = (datos, opts = {}) => {
  const cfg = configImpresora();
  const ip = txt(opts.ip) || cfg.ip;
  const puerto = Number(opts.puerto) || cfg.puerto;
  const timeoutMs = Number(opts.timeoutMs) || cfg.timeoutMs;
  const buffer = Buffer.isBuffer(datos) ? datos : Buffer.from(datos || []);

  if (!ip) {
    return Promise.reject(new Error("Falta TSC_IMPRESORA_IP en el agente."));
  }
  if (!buffer.length) {
    return Promise.reject(new Error("No hay datos TSPL para imprimir."));
  }

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let listo = false;
    const cerrar = (err) => {
      if (listo) return;
      listo = true;
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      if (err) reject(err);
      else resolve({ ip, puerto, bytes: buffer.length });
    };

    socket.setTimeout(timeoutMs);
    socket.once("timeout", () =>
      cerrar(new Error(`Timeout al conectar con la TSC ${ip}:${puerto}`))
    );
    socket.once("error", (err) =>
      cerrar(new Error(`No se pudo imprimir en ${ip}:${puerto}: ${err.message}`))
    );
    socket.connect(puerto, ip, () => {
      socket.write(buffer, (err) => {
        if (err) return cerrar(err);
        socket.end(() => cerrar(null));
      });
    });
  });
};
