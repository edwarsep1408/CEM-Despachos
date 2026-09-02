import { Schema, model } from "mongoose";

const FirmanteSchema = new Schema({
  idFirmante: { type: Number, required: true, unique: true, index: true },
  nombre: { type: String, required: true, trim: true },
  cargo: { type: String, required: true, index: true },
  firma: { type: String, default: "" },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("firmantes", FirmanteSchema);
