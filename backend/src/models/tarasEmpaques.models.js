import { Schema, model } from "mongoose";

const TaraEmpaqueSchema = new Schema({
  idTara: { type: Number, required: true, unique: true, index: true },
  nombre: { type: String, required: true, trim: true },
  unidad: { type: String, required: true, trim: true },
  peso: { type: Number, required: true },
  empaque: { type: String, default: "N/A", trim: true },
  esCaja: { type: Boolean, default: false },
  activo: { type: Boolean, default: true },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("taras_empaques", TaraEmpaqueSchema);
