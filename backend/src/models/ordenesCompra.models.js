import { Schema, model } from "mongoose";

const LineaOcSchema = new Schema(
  {
    nroLinea: { type: String, default: "" },
    ean: { type: String, default: "", index: true },
    codigoComprador: { type: String, default: "", index: true },
    item: { type: String, default: "" },
    codigoItem: { type: String, default: "" },
    referencia: { type: String, default: "" },
    descripcion: { type: String, default: "" },
    undInventario: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    unidadPedido: { type: String, default: "NAR" },
    unidadPedidoEtiqueta: { type: String, default: "" },
    precio: { type: Number, default: 0 },
    empaque: { type: Number, default: 0 },
    kilos: { type: Number, default: 0 },
    unidades: { type: Number, default: 0 },
    matched: { type: Boolean, default: false },
  },
  { _id: true }
);

const OrdenCompraSchema = new Schema({
  idOc: { type: Number, required: true, unique: true, index: true },
  idEnc: { type: String, required: true, unique: true, index: true },
  nroPedido: { type: String, required: true, unique: true, index: true },
  fecha: { type: String, required: true, index: true },
  fechaEntregaDesde: { type: String, default: "" },
  fechaEntregaHasta: { type: String, default: "" },
  usuario: { type: String, default: "" },
  bodegaOrigen: { type: String, required: true, index: true },
  bodegaOrigenNombre: { type: String, default: "" },
  glnProveedor: { type: String, default: "" },
  glnComprador: { type: String, default: "" },
  glnEntrega: { type: String, default: "" },
  glnFacturar: { type: String, default: "" },
  glnGrupo: { type: String, default: "" },
  nombreEstablecimiento: { type: String, default: "", index: true },
  codigoEstablecimiento: { type: String, default: "" },
  razonSocial: { type: String, default: "" },
  observacion: { type: String, default: "" },
  pagoDias: { type: Number, default: null },
  archivoNombre: { type: String, default: "" },
  avisos: { type: [String], default: [] },
  estado: { type: String, default: "temporal", index: true },
  idCargue: { type: Number, default: null, index: true },
  lineas: { type: [LineaOcSchema], default: [] },
  peso: { type: Number, default: 0 },
  unidades: { type: Number, default: 0 },
  valor: { type: Number, default: 0 },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("ordenes_compra", OrdenCompraSchema);
