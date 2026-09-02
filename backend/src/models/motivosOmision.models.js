import { Schema, model } from "mongoose";

const MotivoOmisionSchema = new Schema({
  idMotivo: { type: Number, required: true, unique: true, index: true },
  nombre: { type: String, required: true, trim: true },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("motivos_omision", MotivoOmisionSchema);
