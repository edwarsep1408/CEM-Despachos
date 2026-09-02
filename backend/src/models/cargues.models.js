import { Schema, model } from "mongoose";

const DocumentoCargueSchema = new Schema(
  {
    tipo: { type: String, required: true },
    tipoDoc: { type: String, required: true },
    idEnc: { type: String, required: true },
    nroDoc: { type: String, required: true },
    tipoDocto: { type: String, default: "" },
    nit: { type: String, default: "" },
    fecha: { type: String, default: "" },
    sucursal: { type: String, default: "" },
    municipio: { type: String, default: "" },
    barrio: { type: String, default: "" },
    cndPago: { type: String, default: "" },
    direccion: { type: String, default: "" },
    vendedor: { type: String, default: "" },
    observacion: { type: String, default: "" },
    codigo: { type: String, default: "" },
    codigoCliente: { type: String, default: "" },
    telefono: { type: String, default: "" },
    valor: { type: Number, default: 0 },
    peso: { type: Number, default: 0 },
    unidades: { type: Number, default: 0 },
    cliente: { type: String, default: "" },
    establecimiento: { type: String, default: "" },
    hora: { type: String, default: "" },
    bodega: { type: String, default: "" },
    omitido: { type: Boolean, default: false },
    motivoOmision: { type: String, default: "" },
    estadoDespacho: { type: String, default: "PEND" },
    etiquetasCanasta: { type: Array, default: [] },
    lineas: { type: Array, default: [] },
  },
  { _id: true }
);

const CargueSchema = new Schema({
  idCargue: { type: Number, required: true, unique: true, index: true },
  despachadorId: { type: Schema.Types.ObjectId, ref: "usuarios", required: true },
  despachadorNombre: { type: String, required: true },
  despachadorUsuario: { type: String, default: "" },
  bodega: { type: String, required: true },
  bodegaNombre: { type: String, default: "" },
  estado: { type: String, default: "pendiente", index: true },
  reabiertoDespacho: { type: Boolean, default: false },
  documentos: { type: [DocumentoCargueSchema], default: [] },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_envio: { type: Date, default: null },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("cargues", CargueSchema);
