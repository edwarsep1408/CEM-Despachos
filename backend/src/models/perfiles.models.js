import { Schema, model } from "mongoose";

const PerfilSchema = new Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, default: "" },
  permisos: { type: [String], default: [] },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("perfiles", PerfilSchema);
