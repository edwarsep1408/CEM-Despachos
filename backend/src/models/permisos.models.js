import { Schema, model } from "mongoose";

const PermisoSchema = new Schema({
  codigo: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  modulo: { type: String, required: true },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("permisos", PermisoSchema);
