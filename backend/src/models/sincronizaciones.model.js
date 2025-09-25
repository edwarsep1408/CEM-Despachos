import { Schema, model } from "mongoose";
import { type } from "os";

const SincronizacionesSchema = new Schema({

    nombre_sincronizacion: {type: String},
    descripcion_sincronizacion: {type: String},
    estado_sincronizacion: {type: String, default: 'Finalizado'},
    usuario_iniciador: {type: String},
    total_items_nuevos: {type: Number, default: 0},
    total_actualizaciones: {type : Number, default: 0},
    fecha_sincronizacion: { type: Date, default: Date.now() },
    fecha_modificacion: { type: Date, default: null }
    
},{
    
    collection: 'tbl_sincronizaciones'

});

export default model('tbl_sincronizaciones', SincronizacionesSchema);