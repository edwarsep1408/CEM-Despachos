import { Schema, model } from "mongoose";

const CodigoEanSchema = new Schema({
  idEan: { type: Number, required: true, unique: true, index: true },
  ean: { type: String, required: true, trim: true, index: true },
  cliente: { type: String, default: "todos", trim: true, index: true },
  localizacion: { type: String, default: "1", trim: true },
  referencia: { type: String, required: true, trim: true, index: true },
  descripcion: { type: String, default: "", trim: true },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

CodigoEanSchema.index({ ean: 1, cliente: 1 }, { unique: true });

export default model("codigos_ean", CodigoEanSchema);
