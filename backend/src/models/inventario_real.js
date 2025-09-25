import { Schema, model } from 'mongoose';

const inventarioSchema = new Schema({
    id_item: {type: Number, require: true},
    referencia: {type: String, require: true},
    descripcion: {type: String, require: true},
    Existencia_1: {type: Number, require: true},
    unidad_medida_1: {type: String, require: true},
    Existencia_2: {type: Number, require: true},
    unidad_medida_2: {type: String, require: true},
    codigo_bodega: {type: String, require: true},
    tipo_inventario: {type: String, require: true},
    desc_tipo_inventario: {type: String, require: true},
    id_linea: {type: String, require: true},
    descripcion_linea: {type: String, require: true},
    idSincronizacion: {type: String, require: true},
    fechaSincronizacion: {type: String, require: true},
}, {

    collection: 'inventariounoee'

});

export default model('inventariounoee', inventarioSchema);