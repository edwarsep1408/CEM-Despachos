import { Schema, model } from 'mongoose';

const BodegaSchema = new Schema({
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    nombre: { type: String, require: true, unique: true },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('mesas', BodegaSchema);