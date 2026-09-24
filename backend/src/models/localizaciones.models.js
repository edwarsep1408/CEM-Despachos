import { Schema, model } from "mongoose";

/**
 * Sedes / PDV de cadenas (localización EDI).
 * Fuente típica: Libro zonas (Dep, Localización EDI/GLN, Dependencia, Cadena, Zona).
 */
const LocalizacionSchema = new Schema({
  idLocalizacion: { type: Number, required: true, unique: true, index: true },
  /** Código interno de la dependencia (columna Dep). */
  codigoDep: { type: String, default: "", trim: true, index: true },
  /** GLN / Localización EDI. */
  gln: { type: String, default: "", trim: true, index: true },
  /** Nombre de la sede / dependencia. */
  dependencia: { type: String, required: true, trim: true, index: true },
  cadena: { type: String, default: "", trim: true, index: true },
  zona: { type: String, default: "", trim: true, index: true },
  estado: { type: Number, default: 0, index: true },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

LocalizacionSchema.index({ cadena: 1, codigoDep: 1 });
LocalizacionSchema.index({ gln: 1, estado: 1 });

export default model("localizaciones", LocalizacionSchema);
