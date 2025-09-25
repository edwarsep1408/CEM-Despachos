import { Schema, model } from 'mongoose';

const ConteoSchema = new Schema({
    planilla:{ type: Schema.Types.ObjectId, ref: 'planilla-mesa' },
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    numero_conteo: { type: Number, default: 0 },
    ultimoConteoDetails : { type: Schema.Types.ObjectId, ref: 'conteo-details', default: null },
    total_conteos: { type: Number, default: 0 },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('conteo', ConteoSchema);