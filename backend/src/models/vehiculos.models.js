import { Schema, model } from "mongoose";

const VehiculoSchema = new Schema({
  idVehiculo: { type: Number, index: true },
  placa: { type: String, required: true, trim: true, uppercase: true },
  conductor: { type: String, default: "", trim: true },
  telefono: { type: String, default: "", trim: true },
  capacidad: { type: Number, default: 0 },
  flete: { type: Number, default: 0 },
  idConductor: { type: String, default: "", trim: true },
  supervisor: { type: String, default: "", trim: true },
  despachador: { type: String, default: "", trim: true },
  facturador: { type: String, default: "", trim: true },
  celularPtoContacto: { type: String, default: "", trim: true },
  transportadora: { type: String, default: "", trim: true },
  passwordHash: { type: String, default: "", select: false },
  estado: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("vehiculos", VehiculoSchema);
