import { Schema, model } from "mongoose";

const MuelleSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  bodega: { type: Schema.Types.ObjectId, ref: "bodegas", required: true },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("muelles", MuelleSchema);
