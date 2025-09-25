import { Schema, model } from 'mongoose';

const PlanillasSchema = new Schema({
    planilla: { type: Schema.Types.ObjectId, ref: 'planilla' },
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    colaborador: { type: Schema.Types.ObjectId, ref: 'personal' },
    firma: { type: String, default: 0 },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('planilla-finaliza', PlanillasSchema);