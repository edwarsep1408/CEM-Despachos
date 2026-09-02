import { Schema, model } from "mongoose";

const LineaReaproSchema = new Schema(
  {
    item: { type: String, default: "" },
    codigoItem: { type: String, default: "" },
    referencia: { type: String, default: "" },
    descripcion: { type: String, default: "" },
    undInventario: { type: String, default: "" },
  unidades: { type: Number, default: 0 },
  kilos: { type: Number, default: 0 },
  },
  { _id: true }
);

const ReaproSchema = new Schema({
  idReapro: { type: Number, required: true, unique: true, index: true },
  idEnc: { type: String, required: true, unique: true, index: true },
  fecha: { type: String, required: true, index: true },
  usuario: { type: String, default: "" },
  bodegaOrigen: { type: String, required: true, index: true },
  bodegaOrigenNombre: { type: String, default: "" },
  bodegaDestino: { type: String, required: true, index: true },
  bodegaDestinoNombre: { type: String, default: "" },
  observacion: { type: String, default: "" },
  archivoNombre: { type: String, default: "" },
  cediEtiqueta: { type: String, default: "" },
  avisos: { type: [String], default: [] },
  estado: { type: String, default: "temporal", index: true },
  idCargue: { type: Number, default: null, index: true },
  lineas: { type: [LineaReaproSchema], default: [] },
  peso: { type: Number, default: 0 },
  unidades: { type: Number, default: 0 },
  envioSiesa: {
    estado: { type: String, default: "pendiente" },
    mensaje: { type: String, default: "" },
    fecha: { type: Date, default: null },
  },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("reaprovisionamientos", ReaproSchema);
