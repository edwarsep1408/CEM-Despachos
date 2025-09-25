
import axios from "axios";
import mongoose from "mongoose";
import inventario_real from '../models/inventario_real.js';

const bodegaServicios= {}

bodegaServicios.SincronizacionInventarioUnoee = async () => {

    /* url peticion */
    /* const petitionUrlPrueba = 'http://localhost:3001/api/v1/consultarPrueba'; */
    const petitionUrlPrueba = 'http://192.168.1.252:5015/api/v1/get-existencia-inventario-bodega/13/008';
    /* http://192.168.1.252:5015/api/v1/get-existencia-inventario-bodega/13/PT001 */
    /* fecha de sincronizacion con inventario unoee */
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    const fechaFormateada = `${año}-${mes}-${dia} ${horas}:${minutos}`;
    /* Le asignamos un id a todos los valores de la sincronización */
    const idSincronzacionInventario = new mongoose.Types.ObjectId();
    /* inicializo valores para contar cuantos registros se guardaron */
    let registrosGuardados = 0;
    let registrosNoGuardados = 0;
    
    axios.get(petitionUrlPrueba)
        .then(async function (response) {

            if (response.data.body.length > 0) {

                const respuesta = response.data.body;
                const promesas = respuesta.map((item) => {
                    item.fechaSincronizacion = fechaFormateada;
                    item.idSincronizacion = idSincronzacionInventario;
                    const sincronizacion = new inventario_real(item);
                    return sincronizacion.save()
                        .then(nuevoRegistro => {
                            if (nuevoRegistro) {
                                registrosGuardados++;
                            }
                        })
                        .catch(err => {
                            registrosNoGuardados++;
                        });
                });
                
                for (let index = 0; index < respuesta.length; index++) {
                    
                    respuesta[index].fechaSincronizacion = fechaFormateada;               
                    respuesta[index].idSincronizacion = idSincronzacionInventario;
                    const sincrinizacion = new inventario_real(respuesta[index]);
                    const newRecord = sincrinizacion.save();
                    newRecord.then(nuevoRegistro => {

                        if (nuevoRegistro) {
                        
                           return registrosGuardados = registrosGuardados+1;
    
                        }
                    })
                } 
                
                await Promise.all(promesas);

                console.log("Cantidad de registros agregados ", registrosGuardados);
                return [
                    respta =>  `Se sincronizaron ${registrosGuardados} registros en la base de datos local`,
                ];
            }
        })

};

export default bodegaServicios;