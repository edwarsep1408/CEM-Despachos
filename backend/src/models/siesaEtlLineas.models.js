import { Schema, model } from "mongoose";

const SiesaEtlLineaSchema = new Schema(
  {
    lineaId: { type: String, index: true, unique: true, sparse: true },
    idEnc: { type: String, index: true },
    tipoDocto: { type: String, index: true },
    fecha: { type: String, index: true },
    nit: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
    extraidoEn: { type: Date, default: Date.now },
    tramoDesde: { type: String },
    tramoHasta: { type: String },
  },
  { collection: "siesa_etl_lineas" }
);

export default model("siesa_etl_lineas", SiesaEtlLineaSchema);
