import { Schema, model } from "mongoose";

const LineaFacturaSchema = new Schema(
  {
    linea: { type: Number, default: 0 },
    referencia: { type: String, default: "" },
    um: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    kilos: { type: Number, default: 0 },
    unidades: { type: Number, default: 0 },
    valorBruto: { type: Number, default: 0 },
    concepto: { type: String, default: "" },
    motivo: { type: String, default: "" },
  },
  { _id: false }
);

const FacturaSchema = new Schema({
  id461: { type: String, default: "", index: true },
  id430: { type: String, default: "", index: true },
  numFactura: { type: String, required: true, unique: true, index: true },
  tipoDoc: { type: String, default: "" },
  nroDoc: { type: String, default: "" },
  nit: { type: String, default: "", index: true },
  razonSocial: { type: String, default: "" },
  sucursal: { type: String, default: "" },
  contacto: { type: String, default: "" },
  barrio: { type: String, default: "" },
  municipio: { type: String, default: "" },
  direccion: { type: String, default: "" },
  fecha: { type: String, default: "", index: true },
  valor: { type: Number, default: 0 },
  peso: { type: Number, default: 0 },
  unidades: { type: Number, default: 0 },
  bodega: { type: String, default: "" },
  vendedor: { type: String, default: "" },
  numPedido: { type: String, default: "", index: true },
  tipoDocPedido: { type: String, default: "" },
  cndPago: { type: String, default: "" },
  sep: { type: String, default: "" },
  co: { type: String, default: "" },
  notas: { type: String, default: "" },
  lineas: { type: [LineaFacturaSchema], default: [] },
  fecha_sincronizacion: { type: Date, default: Date.now },
});

export default model("facturas", FacturaSchema);
