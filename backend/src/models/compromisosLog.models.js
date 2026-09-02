import { Schema, model } from "mongoose";

const CompromisoLogSchema = new Schema(
  {
    idEnc: { type: String, index: true },
    cliente: { type: String, default: "" },
    usuario: { type: String, default: "" },
    fecha: { type: Date, default: Date.now, index: true },
    resultado: { type: String, default: "error", index: true },
    mensaje: { type: String, default: "" },
    filas: { type: Number, default: 0 },
    faltantes: { type: [String], default: [] },
    lineas: { type: Array, default: [] },
    errores: { type: Array, default: [] },
    payload: { type: Schema.Types.Mixed, default: null },
    respuesta: { type: Schema.Types.Mixed, default: null },
    origen: { type: String, default: "envio" },
  },
  {
    collection: "compromisos_log",
  }
);

export default model("compromisos_log", CompromisoLogSchema);
