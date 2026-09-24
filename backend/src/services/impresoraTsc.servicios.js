import net from "net";
import fs from "fs";
import path from "path";

const txt = (v) => String(v ?? "").trim();

/** Config TSC MH241T (raw TSPL por red, puerto 9100). */
export const configImpresoraTsc = () => {
  const ip = txt(process.env.TSC_IMPRESORA_IP) || "192.168.1.36";
  const puerto = Number(process.env.TSC_IMPRESORA_PUERTO) || 9100;
  const timeoutMs = Number(process.env.TSC_IMPRESORA_TIMEOUT_MS) || 8000;
  return { ip, puerto, timeoutMs };
};

const PREAMBULO = [
  "SIZE 58.7 mm, 304 mm",
  "GAP 3 mm, 0 mm",
  "SPEED 8",
  "DENSITY 8",
  "SET RIBBON ON",
  "DIRECTION 0,0",
  "REFERENCE 0,0",
  "OFFSET 0 mm",
  "SET REWIND OFF",
  "SET PEEL OFF",
  "SET CUTTER OFF",
  "SET PARTIAL_CUTTER OFF",
  "SET APPLICATOR OFF",
  "SET TEAR ON",
  "CLS",
].join("\r\n");

const escTspl = (valor) =>
  String(valor ?? "")
    .replace(/\r|\n/g, " ")
    .replace(/"/g, "'")
    .slice(0, 80);

const rutaBitmap = (nombre) => {
  // npm run start → cwd = backend/
  const candidatos = [
    path.resolve(process.cwd(), "assets", `pollocoa-banderin-${nombre}.bin`),
    path.resolve(process.cwd(), "src", "..", "assets", `pollocoa-banderin-${nombre}.bin`),
    path.resolve(__dirname, "../../assets", `pollocoa-banderin-${nombre}.bin`),
  ];
  return candidatos.find((p) => {
    try {
      return fs.existsSync(p);
    } catch (_) {
      return false;
    }
  }) || candidatos[0];
};

export const cargarBitmapBanderin = (nombre = "hija") => {
  const archivo = rutaBitmap(nombre === "padre" ? "padre" : "hija");
  try {
    return fs.readFileSync(archivo);
  } catch (_) {
    return Buffer.alloc(0);
  }
};

/** Etiqueta de prueba — layout Éxito (producto + DEP grande + QR). */
export const armarTsplPruebaHija = ({
  ip = "",
  texto = "PRUEBA CEM",
  plu = "0157586",
  pesoKg = "12.50 Kg",
  dependencia = "EXITO ALAMEDAS DEL SINU MONTER",
  zona = "Zona 0",
  codigoDep = "357",
  qr = "TEST-C01",
} = {}) => {
  const bitmap = cargarBitmapBanderin("hija");
  const partes = [Buffer.from(`${PREAMBULO}\r\n`, "utf8")];
  if (bitmap.length) {
    partes.push(Buffer.from("BITMAP 155,1280,19,336,1,", "utf8"));
    partes.push(bitmap);
    partes.push(Buffer.from("\r\n", "utf8"));
  }
  const producto = escTspl(texto || "HIGADO GRANEL COA");
  const peso = escTspl(pesoKg || "12.50 Kg", 16);
  const dep = escTspl(codigoDep || "357", 8);
  const n = dep.length;
  const fx = n <= 3 ? 32 : n <= 4 ? 26 : 22;
  const fy = n <= 3 ? 36 : n <= 4 ? 30 : 24;
  const depTxt = `DEP: ${dep}`;
  const cmds = [
    "CODEPAGE 1252",
    `TEXT 400,1100,"0",90,20,22,"${producto}"`,
    `TEXT 345,1100,"0",90,11,12,"PLU: ${escTspl(plu, 14)}"`,
    `TEXT 295,1100,"0",90,12,13,"${peso}"`,
    `TEXT 115,1100,"0",90,11,12,"${escTspl(dependencia, 28)}"`,
    `TEXT 70,1100,"0",90,10,11,"${escTspl(zona, 20)}"`,
    `TEXT 410,1780,"0",90,${fx},${fy},"${depTxt}"`,
    `QRCODE 285,1760,L,12,A,90,M2,S7,"${escTspl(qr, 48)}"`,
    "PRINT 1,1",
    "",
  ].join("\r\n");
  partes.push(Buffer.from(cmds, "utf8"));
  return Buffer.concat(partes);
};

/**
 * Envía bytes TSPL crudos a la impresora de red.
 * @param {Buffer|Uint8Array} datos
 * @param {{ ip?: string, puerto?: number, timeoutMs?: number }} [opts]
 */
export const enviarTspl = (datos, opts = {}) => {
  const cfg = { ...configImpresoraTsc(), ...opts };
  const ip = txt(opts.ip) || cfg.ip;
  const puerto = Number(opts.puerto) || cfg.puerto;
  const timeoutMs = Number(opts.timeoutMs) || cfg.timeoutMs;
  const buffer = Buffer.isBuffer(datos) ? datos : Buffer.from(datos || []);

  if (!ip) {
    return Promise.reject(new Error("Falta la IP de la impresora TSC (TSC_IMPRESORA_IP)."));
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

export default { configImpresoraTsc, enviarTspl, armarTsplPruebaHija, cargarBitmapBanderin };
