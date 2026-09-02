import { Schema, model } from 'mongoose';

const BodegaSchema = new Schema({
    codigo: { type: String, require: true, unique: true },
    nombre: { type: String, require: true, unique: true },
    ubicacion: { type: String, require: true },
    muellesDespacho: { type: Number, default: 1, min: 1, max: 20 },
    estado: { type: Number, default: 0 },
    fecha_creacion: { type: Date, default: Date.now() },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('bodegas', BodegaSchema);