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
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('items', ItemSchema);