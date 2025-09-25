import { Schema, model } from 'mongoose';

const BodegaSchema = new Schema({
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    nombre: { type: String, require: true, unique: true },
    cedula: { type: String, default: 0 },
    perfil: { type: String, require: true},
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('personal', BodegaSchema);