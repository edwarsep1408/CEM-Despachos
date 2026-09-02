import { Schema, model } from "mongoose";

const PedidoSchema = new Schema(
  {
    idEnc: { type: String, index: true, unique: true, sparse: true },
    tipoDocto: { type: String },
    nit: { type: String },
    sucursal: { type: String },
    sucursalDescripcion: { type: String },
    cliente: { type: String },
    establecimiento: { type: String },
    estado: { type: String },
    estadoSiesa: { type: String },
    idCargue: { type: Number, default: null, index: true },
    compromiso: {
      estado: { type: String, default: "" },
      mensaje: { type: String, default: "" },
      usuario: { type: String, default: "" },
      fecha: { type: Date, default: null },
      filas: { type: Number, default: 0 },
      respuesta: { type: Schema.Types.Mixed, default: null },
    },
    barrio: { type: String },
    municipio: { type: String },
    direccion: { type: String },
    telefono: { type: String },
    observacion: { type: String },
    codigo: { type: String },
    fecha: { type: String, index: true },
    hora: { type: String },
    valor: { type: Schema.Types.Mixed },
    cp: { type: Schema.Types.Mixed },
    enRuta: { type: Schema.Types.Mixed },
    bodega: { type: String },
    barrioPed: { type: String },
    direccionPed: { type: String },
    vendedor: { type: String },
    contacto: { type: String },
    co: { type: String },
    fechaEntrega: { type: String },
    lineas: { type: Array, default: [] },
    siesa: { type: Schema.Types.Mixed, default: [] },
    fecha_sincronizacion: { type: Date, default: Date.now },
  },
  {
    collection: "pedidos",
  }
);

export default model("pedidos", PedidoSchema);
