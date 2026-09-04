import { Schema, model } from "mongoose";

const LineaEntregaSchema = new Schema(
  {
    referencia: { type: String, default: "" },
    concepto: { type: String, default: "" },
    um: { type: String, default: "" },
    cantidadFactura: { type: Number, default: 0 },
    kilos: { type: Number, default: 0 },
    unidades: { type: Number, default: 0 },
    valorBruto: { type: Number, default: 0 },
    cantidadEntregada: { type: Number, default: 0 },
    unidadesDevolucion: { type: Number, default: 0 },
    kilosDevolucion: { type: Number, default: 0 },
    mermaPct: { type: Number, default: 0 },
    kilosMerma: { type: Number, default: 0 },
    unidadesFaltante: { type: Number, default: 0 },
    kilosFaltante: { type: Number, default: 0 },
    valorNovedad: { type: Number, default: 0 },
    motivo: { type: String, default: "" },
    observacion: { type: String, default: "" },
  },
  { _id: false }
);

const EntregaSchema = new Schema(
  {
    estado: { type: String, default: "pendiente" },
    alcance: { type: String, default: "" },
    motivo: { type: String, default: "" },
    observacion: { type: String, default: "" },
    usuario: { type: String, default: "" },
    fecha: { type: Date, default: null },
    nroNovedad: { type: Number, default: 0 },
    tipoPago: { type: String, default: "" },
    notaCredito: { type: String, default: "" },
    auxiliar: { type: String, default: "" },
    firmaCliente: { type: String, default: "" },
    firmaTransporte: { type: String, default: "" },
    firmaEmpresa: { type: String, default: "" },
    lineas: { type: [LineaEntregaSchema], default: [] },
  },
  { _id: false }
);

const RecaudoSchema = new Schema(
  {
    tipo: { type: String, default: "CORRESPONSAL" },
    monto: { type: Number, default: 0 },
    fecha: { type: String, default: "" },
    referencia: { type: String, default: "" },
    recibo: { type: String, default: "" },
    aprobacion: { type: String, default: "" },
    convenio: { type: String, default: "" },
    terminal: { type: String, default: "" },
    codigoUnico: { type: String, default: "" },
    lugar: { type: String, default: "" },
    pagador: { type: String, default: "" },
    nitPagador: { type: String, default: "" },
    beneficiario: { type: String, default: "" },
    nitBeneficiario: { type: String, default: "" },
    cuentaOrigen: { type: String, default: "" },
    cuentaDestino: { type: String, default: "" },
    costo: { type: Number, default: 0 },
    banco: { type: String, default: "Bancolombia" },
    formaPago: { type: String, default: "" },
    oficina: { type: String, default: "" },
    usuarioBanco: { type: String, default: "" },
    tipoId: { type: String, default: "" },
    numeroId: { type: String, default: "" },
    codigoConvenio: { type: String, default: "" },
    referencia2: { type: String, default: "" },
    placaTicket: { type: String, default: "" },
    caja: { type: String, default: "" },
    rrn: { type: String, default: "" },
    foto: { type: String, default: "" },
    usuario: { type: String, default: "" },
    fecha_creacion: { type: Date, default: Date.now },
  },
  { _id: true }
);

const DocumentoHojaSchema = new Schema(
  {
    pedidoIdEnc: { type: String, default: "" },
    tipoDoc: { type: String, default: "FACTURA" },
    tipoDocto: { type: String, default: "" },
    nroFactura: { type: String, default: "" },
    cliente: { type: String, default: "" },
    nit: { type: String, default: "" },
    sucursal: { type: String, default: "" },
    barrio: { type: String, default: "" },
    municipio: { type: String, default: "" },
    direccion: { type: String, default: "" },
    contacto: { type: String, default: "" },
    cndPago: { type: String, default: "" },
    valor: { type: Number, default: 0 },
    peso: { type: Number, default: 0 },
    pesoDetTara: { type: Number, default: 0 },
    destare: { type: Number, default: 0 },
    bodega: { type: String, default: "" },
    idCargue: { type: Number, default: null },
    cargueId: { type: String, default: "" },
    entrega: { type: EntregaSchema, default: () => ({}) },
    recaudos: { type: [RecaudoSchema], default: [] },
  },
  { _id: true }
);

const SnapshotFirmanteSchema = new Schema(
  {
    firmanteId: { type: String, default: "" },
    nombre: { type: String, default: "" },
    cargo: { type: String, default: "" },
    cargoEtiqueta: { type: String, default: "" },
    firma: { type: String, default: "" },
  },
  { _id: false }
);

const CierreRutaSchema = new Schema(
  {
    fecha: { type: Date, default: null },
    usuario: { type: String, default: "" },
    observaciones: { type: String, default: "" },
  },
  { _id: false }
);

const LiquidacionSchema = new Schema(
  {
    gastosOperativos: { type: Number, default: 0 },
    monedas: { type: Number, default: 0 },
    observaciones: { type: String, default: "" },
    estado: { type: String, default: "sin_liquidar" },
    aprobadoPor: { type: String, default: "" },
    fechaAprobacion: { type: Date, default: null },
  },
  { _id: false }
);

const ConsignacionSchema = new Schema(
  {
    banco: { type: String, default: "Bancolombia" },
    valor: { type: Number, default: 0 },
    referencia: { type: String, default: "" },
    fecha: { type: String, default: "" },
    hora: { type: String, default: "" },
    foto: { type: String, default: "" },
    cuenta: { type: String, default: "" },
    usuario: { type: String, default: "" },
    origen: { type: String, default: "conductor" },
    fecha_creacion: { type: Date, default: Date.now },
  },
  { _id: true }
);

const HojaRutaSchema = new Schema({
  idHoja: { type: Number, required: true, unique: true, index: true },
  fecha: { type: String, required: true, index: true },
  usuario: { type: String, required: true },
  nombre: { type: String, required: true, trim: true },
  placa: { type: String, required: true, trim: true, uppercase: true },
  conductor: { type: String, default: "" },
  telefono: { type: String, default: "" },
  capacidad: { type: String, default: "" },
  supervisor: { type: String, default: "" },
  despachador: { type: String, default: "" },
  facturador: { type: String, default: "" },
  celularPtoContacto: { type: String, default: "" },
  transportadora: { type: String, default: "" },
  pesoAdicional: { type: Number, default: 0 },
  temperatura: { type: String, default: "" },
  canastas: { type: String, default: "" },
  bultos: { type: String, default: "" },
  auxiliar: { type: String, default: "" },
  telDistribucion: { type: String, default: "" },
  canastasIfco: { type: String, default: "" },
  observaciones: { type: String, default: "" },
  firmanteCalidad: { type: SnapshotFirmanteSchema, default: null },
  firmanteLogistica: { type: SnapshotFirmanteSchema, default: null },
  estado: { type: String, default: "temporal", index: true },
  documentos: { type: [DocumentoHojaSchema], default: [] },
  cierre: { type: CierreRutaSchema, default: () => ({}) },
  liquidacion: { type: LiquidacionSchema, default: () => ({}) },
  consignaciones: { type: [ConsignacionSchema], default: [] },
  fecha_creacion: { type: Date, default: Date.now },
  fecha_actualizacion: { type: Date, default: null },
});

export default model("hojas_ruta", HojaRutaSchema);
