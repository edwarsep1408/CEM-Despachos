import { Schema, model } from 'mongoose';

const PlanillasEventSchema = new Schema({
    planilla: { type: Schema.Types.ObjectId, ref: 'planilla' },
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    conteo: {type: Schema.Types.ObjectId, ref: 'conteo' },
    conteoDetails: {type: Schema.Types.ObjectId, ref: 'conteo' },
    descripcion:{ type: String, default: '' },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('conteo-correccion-admin', PlanillasEventSchema);