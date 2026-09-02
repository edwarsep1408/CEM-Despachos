import { Schema, model } from 'mongoose';

const ItemSchema  = new Schema({
    item: {type: String},
    codigoItem: {type: String},
    referencia: {type: String},
    descripcion: {type: String},
    descCorta: {type: String},
    idTipoinventario: {type: String},
    descTipoInventario: {type: String},
    undInventario: {type: String},
    undAdicional: {type: String},
    linea: {type: String},
    estado: {type: String},
    combinacion: {type: String},
    vidaUtilMeses: { type: Number, default: 0 },
    vidaUtilDias: { type: Number, default: 0 },
    vidaUtilEtiqueta: { type: String, default: "" },
    unidadesEmpaque: { type: Number, default: 0 },
    unidadesEmpaqueMax: { type: Number, default: 0 },
    taraNombre: { type: String, default: "" },
    estadoFrio: { type: String, default: "" },
    logisticaLocal: { type: Boolean, default: false },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('items', ItemSchema);