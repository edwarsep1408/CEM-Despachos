import { Schema, model } from "mongoose";

const UsuarioSchema = new Schema({
  usuario: { type: String, required: true },
  nombre: { type: String, required: true },
  password: { type: String, required: true },
  perfil: { type: Schema.Types.ObjectId, ref: "perfiles", default: null },
  bodega: { type: String, default: "" },
  bodegaNombre: { type: String, default: "" },
  muelle: { type: Number, default: 0 },
  cargo: { type: String, default: "" },
  puedeFirmar: { type: Boolean, default: false },
  cargoFirma: { type: String, default: "" },
  firma: { type: String, default: "" },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("usuarios", UsuarioSchema);
