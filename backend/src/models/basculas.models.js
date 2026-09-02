import { Schema, model } from "mongoose";

const BasculaSchema = new Schema({
  nombre: { type: String, required: true, trim: true },
  ip: { type: String, required: true, trim: true },
  puerto: { type: Number, required: true, default: 5001 },
  bodega: { type: Schema.Types.ObjectId, ref: "bodegas", required: true },
  muelle: { type: Schema.Types.ObjectId, ref: "muelles", default: null },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("basculas", BasculaSchema);
