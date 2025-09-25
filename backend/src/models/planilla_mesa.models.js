import { Schema, model } from 'mongoose';


function formatoFecha(ano, mes, dia) {
    
    let date= new Date(Date.UTC(ano, mes -1 , dia));
    console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM");
    
    console.log( "-----------------------------> FECHA PLANILLA ",date);
    
    return date;
}

const PlanillasSchema = new Schema({
    bodega: { type: Schema.Types.ObjectId, ref: 'bodegas' },
    mesa: { type: Schema.Types.ObjectId, ref: 'mesas' },
    colaborador: { type: Schema.Types.ObjectId, ref: 'personal' },
    numero_planilla: { type: Number, default: 0 },
    estado: { type: Number, default: 0 },
    ano: { type: Number, default: null },
    mes: { type: Number, default: null },
    dia: { type: Number, default: null },
    fecha_inventario: { type: Date, default: formatoFecha(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate()) },
    fecha_creacion: { type: Date, default: Date(Date.now()) },
    fecha_actualizacion: { type: Date, default: null }
});

export default model('planilla-mesa', PlanillasSchema);