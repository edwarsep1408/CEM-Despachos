import path from "path";
import os from "os";
import { createWorker } from "tesseract.js";
import { parsearTextoComprobante } from "../data/parsearComprobante";

let workerPromise = null;
const CACHE = path.join(os.tmpdir(), "cem-tess");

const dataUrlABuffer = (foto) => {
  const s = String(foto || "").trim();
  const m = s.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!m) {
    const error = new Error("La foto del comprobante no es válida.");
    error.status = 400;
    throw error;
  }
  return Buffer.from(m[1], "base64");
};

const obtenerWorker = async () => {
  if (!workerPromise) {
    workerPromise = createWorker("spa", 1, {
      logger: () => {},
      cachePath: CACHE,
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
};

export const leerComprobanteDesdeFoto = async (foto) => {
  const buffer = dataUrlABuffer(foto);
  let texto = "";
  try {
    const worker = await obtenerWorker();
    const result = await worker.recognize(buffer);
    texto = String(result?.data?.text || "").trim();
  } catch (error) {
    const e = new Error(
      "No se pudo leer el texto del comprobante. Tome la foto de nuevo, de frente y con buena luz."
    );
    e.status = 400;
    e.causa = error.message;
    throw e;
  }
  const parsed = parsearTextoComprobante(texto);
  return {
    ...parsed,
    leido: Boolean(parsed.monto || parsed.tipo !== "OTRO"),
  };
};
