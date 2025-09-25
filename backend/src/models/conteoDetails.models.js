import { Schema, model } from 'mongoose';

const ConteoSchema = new Schema({
    planilla:{ type: Schema.Types.ObjectId, ref: 'planilla-mesa' },
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    producto : { type: Schema.Types.ObjectId, ref: 'items' },
    colaborador: { type: Schema.Types.ObjectId, ref: 'personal' },
    conteo: {type: Schema.Types.ObjectId, ref: 'conteo' },
    numero_conteo: { type: Number, default: 0 },
    numero_canastas: { type: Number, default: 0 },
    numero_canastillas: { type: Number, default: 0 },
    numero_bultos: { type: Number, default: 0 },
    numero_cajas: { type: Number, default: 0 },
    carreta: { type: Number, default: 0 },
    kg_pesados: { type: Number, default: 0 },
    unidades_contadas: { type: Number, default: 0 },
    kg_neto: { type: Number, default: 0 },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('conteo-details', ConteoSchema);