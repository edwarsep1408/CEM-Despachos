import bodegaModel from '../models/bodega.models'
import axios from "axios";
import mongoose from 'mongoose';
import inventario_real from '../models/inventario_real';
import pedidosModel from '../models/pedidos.models';
import siesaPedidos from '../services/siesaPedidos.servicios';
import { sincronizarCatalogoBodegas } from '../services/siesaBodegas.servicios';
import { consultarExistenciasPorBodega, consultarExistenciasCompania, fuenteExistenciasCem, listarBodegasInventario, esBodegaCompania, esStInventarioCompania, esCanastaInventario, esCanastillaInventario, cantidadCanastaFila, kgInventarioFila, unidadesInventarioFila, totalKgEtc, totalUnidadesEtc, totalCanastasEtc } from '../services/siesaExistencias.servicios';
import { CATALOGO_BODEGAS_ETC, normalizarCodigoBodega, ordenarBodegasPorCodigo } from '../data/bodegasGrupoEtc';
import { consultarExistenciasCemPorBodega, consultarExistenciasCemCompania } from '../services/cemInventario.servicios';
import { consultarDocumentosStSiesa, programarRefrescoSt, resumenSt, kpisTransito, agruparDocumentosSt } from '../services/siesaSt.servicios';
import { armarIndicadoresInventario } from '../services/dashboardIndicadores.servicios';

const CEM_INVENTARIO_API = process.env.CEM_INVENTARIO_API || 'http://192.168.1.252:5015/api/v1';
const SIESA_ID_CIA = process.env.SIESA_ID_CIA || '13';
const INVENTARIO_TIMEOUT_MS = Number(process.env.CEM_INVENTARIO_TIMEOUT_MS || 25000);

const bodegaCtr = {}

bodegaCtr.postBodega = async (req, res) => {
    const body = req.body;

    try {

        const validacionBodega = await bodegaModel.findOne({
            'codigo': body.codigo,
            'nombre': body.nombre,
            'estado': 0
        });

        if (validacionBodega) {
            return res.status(400).json({
                status: 400,
                body: { message: 'La bodega ya esta registrada' },
                error: false
            });
        }

        const newBodega = new bodegaModel(body);
        const storageBodega = await newBodega.save();

        if (!storageBodega) {
            return res.status(404).json({
                status: 404,
                body: { message: 'No se guardó la bodega' },
                error: false
            });
        }

        return res.status(200).json({
            status: 200,
            body: storageBodega,
            error: false
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        });
    }
};

bodegaCtr.getBodegas = async (req, res) => {
    try {
        const bodegas = await bodegaModel.find({ estado: 0 }).sort({ codigo: 1 });
        if (!bodegas.length) {
            return res.status(404).json({
                status: 404,
                body: { message: "No se encontraron bodegas" },
                error: false,
            });
        }
        return res.status(200).json({
            status: 200,
            body: bodegas,
            error: false,
        });
    } catch (error) {
        console.error("Error consultando bodegas:", error);
        return res.status(500).json({
            status: 500,
            body: { message: "Hay un error en el servidor" },
            error: true,
        });
    }
};

bodegaCtr.sincronizarBodegasSiesa = async (req, res) => {
    try {
        const resultado = await sincronizarCatalogoBodegas(bodegaModel);
        const bodegas = await bodegaModel.find({ estado: 0 }).sort({ codigo: 1 });
        return res.status(200).json({
            status: 200,
            body: {
                message: `Se sincronizaron ${resultado.sincronizadas} bodegas desde SIESA.`,
                ...resultado,
                bodegas,
            },
            error: false,
        });
    } catch (error) {
        console.error("Sincronizar bodegas SIESA:", error.message);
        return res.status(502).json({
            status: 502,
            body: { message: error.message || "No se pudieron sincronizar las bodegas con SIESA." },
            error: true,
        });
    }
};

bodegaCtr.updateBodega = async (req, res) => {
    const body = req.body;

    try {

        const bodega = await bodegaModel.findByIdAndUpdate({ '_id': body._id }, body, { new: true }).exec();

        if (!bodega) {
            return res.status(404).json({ status: 404, body: { message: 'No se pudo actualizar la bodega' }, error: false });
        }

        return res.status(200).json({ status: 200, body: bodega, error: false });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, body: { message: 'Hay un error en el servidor' }, error: true });
    }
};

bodegaCtr.deleteBodega = async (req, res) => {

    try {

        const { _id } = req.params

        const result = await bodegaModel.findByIdAndUpdate({ _id }, { "estado": 2 })

        if (!result) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se pudo eliminar la bodega' },
                error: false
            })
        }


        res.status(200).json({
            status: 200,
            body: result,
            error: false
        })


    } catch (error) {

        console.log(error)

        res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        })

    }

}

const leerExistenciasBodega = (bodega) =>
    fuenteExistenciasCem()
        ? consultarExistenciasCemPorBodega(bodega)
        : consultarExistenciasPorBodega(bodega);

const leerExistenciasCompania = () =>
    fuenteExistenciasCem()
        ? consultarExistenciasCemCompania()
        : consultarExistenciasCompania();

const leerDocumentosSt = () =>
    consultarDocumentosStSiesa().catch((error) => {
        console.error("ST:", error.message);
        return [];
    });

const TIPOS_INVENTARIO_BODEGA = new Set([
    'INV143502',
    'INV143502G',
    'INV143502T',
    'INV143503',
    'INVSUBEX',
    'INVSUB',
    'INVCANASTA',
    'INV143501',
]);

const tipoInventarioPermitido = (tipo) => {
    const valor = String(tipo || "").trim();
    return !valor || TIPOS_INVENTARIO_BODEGA.has(valor);
};

bodegaCtr.getInventarioBodega = async (req, res) => {

    const bodega = req.params._bodega;
    let productosConInventario = [];
    let productosSinInventario = [];
    let lineaProductos = [];
    let lineaItems = [];
    let canastas = 0;
    let canastillas = 0;
    const data = [];
    const labels = [];
    let totalPeso = 0;
    let totalUnidades = 0;
    let dataLinea = [];
    let labelsLinea = [];
    let dataCmbnacionCriterios = [];
    let labelsCmbnacionCriterios = [];
    let combinacionCriteriosInfo = [];
    let combinacionCriteriosMayorAMenor = [];

    try {
        const respuesta = await leerExistenciasBodega(bodega);
            if (respuesta.length > 0) {

                /* Se guarda en los array los productos con inventario y/o producto sin inventario */

                /* Si la descripcion del producto es canastas o canastillas guarda estos valores para mostrarlo al usuario */
                for (let index = 0; index < respuesta.length; index++) {

                    const tipo_inventario = String(respuesta[index].tipo_inventario || "").trim();
                    const descripcionLinea = String(respuesta[index].descripcion_linea || "").trim() || null;
                    const idLinea = String(respuesta[index].id_linea || "").trim() || null;
                    const id_comb_criterio = String(respuesta[index].id_comb_criter || "").trim() || null;
                    const nombreItem = String(respuesta[index].descripcion || "").trim().toUpperCase();

                    {

                        const { referencia, descripcion, unidad_medida_1, unidad_medida_2, Existencia_1, Existencia_2, abc_rotacion_veces, id_linea, descripcion_linea, id_comb_criter, descrip_comb_criter } = respuesta[index];

                        if (esCanastaInventario(respuesta[index])) {
                            const cant = cantidadCanastaFila(respuesta[index]);
                            if (esCanastillaInventario(respuesta[index])) {
                                canastillas += cant;
                            } else {
                                canastas += cant;
                            }
                        } else {

                            if (respuesta[index].Existencia_1 === 0 && respuesta[index].Existencia_2 === 0) {

                                productosSinInventario.push({ 'referencia': referencia, 'descripcion': descripcion, 'unidad_medida_1': unidad_medida_1, 'Existencia_1': Existencia_1, 'unidad_medida_2': unidad_medida_2, 'Existencia_2': Existencia_2, 'abc_rotacion_veces': abc_rotacion_veces });

                            } else {

                                productosConInventario.push({ 'referencia': referencia, 'descripcion': descripcion, 'unidad_medida_1': unidad_medida_1, 'Existencia_1': Existencia_1, 'unidad_medida_2': unidad_medida_2, 'Existencia_2': Existencia_2, 'abc_rotacion_veces': abc_rotacion_veces, 'id_linea': id_linea, 'descripcion_linea': descripcion_linea, 'id_comb_criter': id_comb_criter, 'descrip_comb_criter': descrip_comb_criter });
                                if (kgInventarioFila(respuesta[index]) > 0) {

                                    totalPeso += kgInventarioFila(respuesta[index]);
                                    totalUnidades += unidadesInventarioFila(respuesta[index]);

                                }

                            }

                            if (descripcionLinea !== null) {

                                lineaProductos[descripcionLinea] = 0;
                            }

                            /* nueva forma agrupar la información por línea */
                            if (idLinea !== null) {
                                lineaItems[idLinea] = {

                                    id_linea: respuesta[index].id_linea,
                                    descripcion_linea: respuesta[index].descripcion_linea,
                                    existencia_kl: 0,
                                    existencia_unidad: 0

                                };
                            }

                            if (id_comb_criterio !== null) {


                                combinacionCriteriosInfo[id_comb_criterio] = {

                                    id_comb_criter: respuesta[index].id_comb_criter,
                                    comb_criter_descripcion: respuesta[index].descrip_comb_criter,
                                    kilogramos: 0,
                                    unidades: 0
                                }

                            }

                        }
                    }
                }

                /* Acumular los valores por cada línea  */
                for (let index = 0; index < productosConInventario.length; index++) {

                    const id_linea = String(productosConInventario[index].id_linea || "").trim() || null;
                    const descripcionLinea = String(productosConInventario[index].descripcion_linea || "").trim() || null;
                    const descrip_comb_criter = String(productosConInventario[index].descrip_comb_criter || "").trim() || null;
                    const id_comb_criter = String(productosConInventario[index].id_comb_criter || "").trim() || null;

                    if (descripcionLinea && !esCanastaInventario(productosConInventario[index])) {

                        lineaProductos[descripcionLinea] += productosConInventario[index].Existencia_1;

                        /* nueva forma agrupar la información  */

                        if (id_linea !== null) {

                            if (lineaItems[id_linea]) {

                                lineaItems[id_linea].existencia_kl += productosConInventario[index].Existencia_1;
                                lineaItems[id_linea].existencia_unidad += productosConInventario[index].Existencia_2;

                            }
                        }

                        if (id_comb_criter !== null) {

                            if (combinacionCriteriosInfo[id_comb_criter]) {

                                combinacionCriteriosInfo[id_comb_criter].kilogramos += productosConInventario[index].Existencia_1;
                                combinacionCriteriosInfo[id_comb_criter].unidades += productosConInventario[index].Existencia_2;

                            }
                        }
                    }
                }

                let formato = new Intl.NumberFormat('es-ES');

                if (combinacionCriteriosInfo) {

                    combinacionCriteriosMayorAMenor = Object.values(combinacionCriteriosInfo).sort((a, b) => {

                        if (a.kilogramos > b.kilogramos) {

                            return -1;

                        }

                        if (a.kilogramos < b.kilogramos) {

                            return 1;

                        }

                        return 0;
                    });


                    labelsCmbnacionCriterios = combinacionCriteriosMayorAMenor.map(item => item.comb_criter_descripcion);
                    dataCmbnacionCriterios = combinacionCriteriosMayorAMenor.map(item => item.kilogramos);

                }
                /* ordenar los valores de las líneas de mayor a menor */

                const valoresLineaOrganizados = Object.entries(lineaProductos).sort(([, a], [, b]) => b - a);

                /* Después de tener la data organizada de mayor a menor tomamos los labels y la data para enviarla al front */

                labelsLinea = valoresLineaOrganizados.map(([label]) => label);
                dataLinea = valoresLineaOrganizados.map(([, value]) => Number(value) || 0);

                if (!labelsLinea.length && productosConInventario.length) {
                    const top = productosConInventario.slice(0, 12);
                    labelsLinea = top.map((item) => item.descripcion);
                    dataLinea = top.map((item) => Number(item.Existencia_1) || 0);
                }
                if (!labelsCmbnacionCriterios.length && productosConInventario.length) {
                    const top = productosConInventario.slice(0, 12);
                    labelsCmbnacionCriterios = top.map((item) => item.descripcion);
                    dataCmbnacionCriterios = top.map((item) => Number(item.Existencia_1) || 0);
                }

                /* Se organiza la información de inventario con info de mayor a menor de acuerdo a cantidad en inventario  */
                productosConInventario.sort((a, b) => b.Existencia_1 - a.Existencia_1);

                /* Se crean arrays para enviar al front y pintar gráficas  */

                for (let index = 0; index < productosConInventario.length; index++) {
                    const { referencia, descripcion, unidad_medida_1, unidad_medida_2, Existencia_1, Existencia_2 } = productosConInventario[index];

                    if (index <= 10) {

                        const formatNumber = Number(Existencia_1.toFixed(2));
                        data.push(formato.format(formatNumber));
                        labels.push(descripcion);

                    }
                }



                return res.status(200).json({
                    status: 200,
                    body: {
                        data: dataCmbnacionCriterios,
                        labels: labelsCmbnacionCriterios,
                        productosSinInventario,
                        canastas,
                        canastillas,
                        totalPeso,
                        totalUnidades,
                        productosConInventario,
                        labelsLinea,
                        dataLinea
                    }
                });
            }

            return res.status(200).json({
                status: 200,
                body: {
                    data: [],
                    labels: [],
                    productosSinInventario: [],
                    canastas: 0,
                    canastillas: 0,
                    totalPeso: 0,
                    totalUnidades: 0,
                    productosConInventario: [],
                    labelsLinea: [],
                    dataLinea: [],
                    aviso: 'SIESA no devolvió existencias para esa bodega.',
                },
                error: false,
            });
    } catch (error) {
            console.error('Error consultando inventario bodega:', error.message);
            if (!res.headersSent) {
                return res.status(502).json({
                    status: 502,
                    body: { message: error.message || 'No se pudo consultar existencias de la bodega.' },
                    error: true,
                });
            }
        }
}

bodegaCtr.actualizarInformacionTiemporeal = (req, res) => {

    /* url peticion */
    /* const petitionUrlPrueba = 'http://localhost:3001/api/v1/consultarPrueba'; */
    const petitionUrlPrueba = `${CEM_INVENTARIO_API}/get-existencia-inventario-bodega/${SIESA_ID_CIA}/008`;
    /* ${CEM_INVENTARIO_API}/get-existencia-inventario-bodega/13/PT001 */
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

                    respuesta[index].fechaSincronizacion = fechaSincronizacion;
                    respuesta[index].idSincronizacion = idSincronzacionInventario;
                    const sincrinizacion = new inventario_real(respuesta[index]);
                    console.log(respuesta[index]);

                    const newRecord = sincrinizacion.save();
                    newRecord.then(nuevoRegistro => {
                        if (nuevoRegistro) {
                            console.log("ingreso acá");

                            return registrosGuardados = registrosGuardados + 1;

                        }
                    })
                }

                await Promise.all(promesas);
                console.log("news registros", registrosGuardados);
                return res.status(200).json({
                    respta: `Se sincronizaron ${registrosGuardados} registros en la base de datos local`,
                })
            }
        })
        .catch((error) => {
            console.error('Error sincronizando inventario UnoEE:', error.message);
            if (!res.headersSent) {
                return res.status(502).json({
                    status: 502,
                    body: { message: 'No se pudo sincronizar inventario UnoEE.' },
                    error: true,
                });
            }
        });
}

bodegaCtr.inventarioTotalCompania = async (req, res) => {

    let informacionAgrupada = {};
    let labelsLinea = [];
    let valuesLinea = [];
    let detallesLinea = {};
    let combinacionCriteriosInfo = [];
    let labelCombCriterios = [];
    let kgCombCriterios = [];
    let unidadesCombCriterios = [];
    let totalKgCompania = 0;
    let totalUnidadesCompania = 0;
    let totalKgMovimiento = 0;
    let totalUnidadesMovimiento = 0;
    let canastasEnMovimiento = 0;
    let canastillasEnMovimiento = 0;
    let sumaLineas = [];
    let infoBodegas = [];
    let insumosConInventario = [];
    let insumosSinInventario = [];

    try {

        const esperaStMs = Number(process.env.SIESA_ST_ESPERA_MS || 0);
        const infoBodegasCargada = await leerExistenciasCompania();
        infoBodegas = Array.isArray(infoBodegasCargada) ? infoBodegasCargada : [];
        let infoEnTransito = await consultarDocumentosStSiesa(esperaStMs).catch((error) => {
            console.error("ST:", error.message);
            return resumenSt().filas || [];
        });
        infoEnTransito = Array.isArray(infoEnTransito) ? infoEnTransito : [];

        /* INICIALIZAR LOS VALORES DE LAS VARIABLES */

        infoBodegas.forEach(element => {
                /* hacer trim para eliminar espacios */
                const referencia = String(element.referencia || "").trim();
                const codigo_bodega = String(element.codigo_bodega || "").trim();
                if (!referencia || !codigo_bodega) return;
                if (esCanastaInventario(element)) return;
                const nombreLinea = element.descripcion_linea === null ? 'novalue' : element.descripcion_linea.trim();
                const idLinea = element.id_linea === null ? 'novalue' : element.id_linea.trim();
                const cantidad = element.Existencia_1;
                const id_comb_criterio = element.id_comb_criter !== null ? element.id_comb_criter.trim() : null;

                if (!informacionAgrupada[referencia]) {

                    informacionAgrupada[referencia] = {
                        referencia: referencia,
                        descripcion: element.descripcion,
                        rotacion: element.abc_rotacion_veces,
                        detalleBodega: {}
                    };
                }

                informacionAgrupada[referencia].detalleBodega[codigo_bodega] = { peso: 0, unidades: 0 };

                if (idLinea !== null) {

                    detallesLinea[idLinea] = {

                        id_linea: idLinea,
                        descripcionLinea: element.descripcion_linea,
                        unidades: 0,
                        peso: 0,
                        detalleItemsLinea: {
                        }
                    }

                }

                const agregarItemLinea = detallesLinea[idLinea];
                if (agregarItemLinea) {

                    if (!agregarItemLinea.detalleItemsLinea[referencia]) {

                        agregarItemLinea.detalleItemsLinea[referencia] = { peso: 0, unidades: 0, referencia: referencia, descripcion: element.descripcion };

                    }
                }

                if (id_comb_criterio !== null) {
                    combinacionCriteriosInfo[id_comb_criterio] = {
                        id_comb_criter: id_comb_criterio,
                        descripcion_combinacion: element.descrip_comb_criter,
                        kilogramos: 0,
                        unidades: 0,
                    }
                }
        });

        /* Tomar las bodegas del grupo ETC (aunque no tengan kilos hoy) */
        const bodegas = {};
        CATALOGO_BODEGAS_ETC.forEach((item) => {
            bodegas[item.codigo] = {
                id_bodega: item.codigo,
                desc_bodega: item.descripcion,
            };
        });
        infoBodegas.forEach(element => {

            const codig_bodeg = String(element.codigo_bodega || "").trim();
            if (codig_bodeg && !bodegas[codig_bodeg]) {
                bodegas[codig_bodeg] = {
                    id_bodega: codig_bodeg,
                    desc_bodega: String(element.descripcion_bodega || "").trim() || codig_bodeg
                };
            } else if (codig_bodeg && bodegas[codig_bodeg] && element.descripcion_bodega) {
                const desc = String(element.descripcion_bodega).trim();
                if (desc && desc.toUpperCase() !== "INACTIVA") {
                    bodegas[codig_bodeg].desc_bodega = desc;
                }
            }
        });


        const infoBodegasProceso = ordenarBodegasPorCodigo(Object.values(bodegas));
        /* Recorrer el array principal y array bodegas para agregar bodegas que no tienen el producto y ponerlo en 0 peso y unidades*/
        Object.values(informacionAgrupada).forEach(item => {
            infoBodegasProceso.forEach(values => {
                if (!item.detalleBodega[values.id_bodega]) {

                    item.detalleBodega[values.id_bodega] = { peso: 0, unidades: 0 }

                }
            });
        });

        /* Recorrer la información de las bodegas y asociar las informaciones de las cantidades según la referencia y bodega*/
        infoBodegas.forEach(element => {
                /* trim para eliminar espacios */
                const referencia = String(element.referencia || "").trim();
                const codigo_bodega = String(element.codigo_bodega || "").trim();
                if (!referencia || !codigo_bodega) return;
                const nombreItem = String(element.descripcion || "").trim().toUpperCase();
                if (esCanastaInventario(element)) return;
                const nombreLinea = element.descripcion_linea === null ? 'novalue' : element.descripcion_linea.trim();
                const cantidad = kgInventarioFila(element);
                const cantidadUnidades = unidadesInventarioFila(element);
                const idLinea = element.id_linea === null ? 'novalue' : element.id_linea.trim();
                const id_combn_criterios = element.id_comb_criter === null ? null : element.id_comb_criter.trim();

                if (!informacionAgrupada[referencia]) {
                    informacionAgrupada[referencia] = {
                        referencia: referencia,
                        descripcion: element.descripcion,
                        rotacion: element.abc_rotacion_veces,
                        detalleBodega: {}
                    };
                }

                const refInfo = informacionAgrupada[referencia];
                const itemsLinea = detallesLinea[idLinea];
                if (!refInfo.detalleBodega[codigo_bodega]) {
                    refInfo.detalleBodega[codigo_bodega] = { peso: 0, unidades: 0, promedio: 0 }
                }
                informacionAgrupada[referencia].detalleBodega[codigo_bodega].peso += cantidad;
                informacionAgrupada[referencia].detalleBodega[codigo_bodega].unidades += cantidadUnidades;

                if (cantidad > 0) {

                    totalKgCompania += cantidad;
                    totalUnidadesCompania += cantidadUnidades;

                }

                if (idLinea !== null) {
                    detallesLinea[idLinea].peso += cantidad;
                    detallesLinea[idLinea].unidades += cantidadUnidades;
                }
                /* combinacion criterios */
                if (id_combn_criterios !== null) {
                    combinacionCriteriosInfo[id_combn_criterios].kilogramos += cantidad;
                    combinacionCriteriosInfo[id_combn_criterios].unidades += cantidadUnidades;
                }
                /* Agregar items a la información de las líneas */
                if (itemsLinea) {
                    if (!itemsLinea.detalleItemsLinea[referencia]) {
                        itemsLinea.detalleItemsLinea[referencia] = { peso: 0, unidades: 0, referencia: referencia, descripcion: element.descripcion };
                    } else {
                        itemsLinea.detalleItemsLinea[referencia].peso += cantidad;
                        itemsLinea.detalleItemsLinea[referencia].unidades += cantidadUnidades;
                    }
                }
        });


        if (combinacionCriteriosInfo) {

            const combina_criter_ordenado = Object.values(combinacionCriteriosInfo).sort((a, b) => {

                if (a.kilogramos > b.kilogramos) {
                    return -1;
                }
                if (a.kilogramos < b.kilogramos) {
                    return 1;
                }

                return 0;

            });

            labelCombCriterios = combina_criter_ordenado.map(item => item.descripcion_combinacion);
            kgCombCriterios = combina_criter_ordenado.map(item => item.kilogramos);
            unidadesCombCriterios = combina_criter_ordenado.map(item => item.unidades);
        }

        /* Sumar total porcentaje participacion para poder sacar porcentaje de participación de cada línea */
        const totalPesoDetallesLinea = Object.values(detallesLinea).reduce((sum, item) => sum + item.peso, 0);

        /* Calcular porcentaje de participación de cada línea */
        Object.entries(detallesLinea).map(([key, item]) => {

            item.porcentajeParticipacion = totalPesoDetallesLinea > 0 ? (item.peso / totalPesoDetallesLinea) * 100 : 0;

        });

        /* El tránsito no entra al inventario en bodega: va solo a los KPI de movimiento. */
        const filasSt = infoEnTransito.filter((row) => esStInventarioCompania(row));
        const movSt = kpisTransito(filasSt);
        totalKgMovimiento = movSt.totalKgMovimiento;
        totalUnidadesMovimiento = movSt.totalUnidadesMovimiento;
        canastasEnMovimiento = movSt.canastasEnMovimiento;
        canastillasEnMovimiento = movSt.canastillasEnMovimiento;

        /* Convertir objeto en array para trabajarlo con ngfor en el frontend  */
        const bodegasDisponibles = [...infoBodegasProceso];
        const documentosEnTrasporte = agruparDocumentosSt(filasSt);
        const informacionAgrupadaFront = Object.values(informacionAgrupada);
        const detallesLineaFront = Object.values(detallesLinea);
        totalKgCompania = totalKgEtc(infoBodegas);
        totalUnidadesCompania = totalUnidadesEtc(infoBodegas);
        const canastasCia = totalCanastasEtc(infoBodegas);
        const totales = {
            totalKgCompania,
            totalUnidadesCompania,
            totalKgMovimiento,
            totalUnidadesMovimiento,
            canastas: canastasCia.canastas,
            canastillas: canastasCia.canastillas,
            canastasEnMovimiento,
            canastillasEnMovimiento,
        };
        const estadoSt = resumenSt();

        /* TOMAR EL VALOR DE LOS DETALLE LÍNEA PARA HACER LA CHART */
        detallesLineaFront.map((linea) => {
            const { id_linea, descripcionLinea, peso, unidades } = linea;
            sumaLineas.push({
                id_linea,
                descripcionLinea,
                peso,
                unidades
            });
        });

        const lineasOrganizadasCantidad = Object.entries(sumaLineas).sort(([, a], [, b]) => b.peso - a.peso);
        const lineasNumerosFormateados = lineasOrganizadasCantidad.map(([linea, valor]) => [linea, valor]);

        lineasNumerosFormateados.map(([linea, values]) => {

            if (values.descripcionLinea != 'CANASTAS' && values.descripcionLinea != null) {

                labelsLinea.push(values.descripcionLinea);
                valuesLinea.push(values.peso);
            }
            if (values.descripcionLinea === null) {

                labelsLinea.push("nonvalue");
                valuesLinea.push(values.peso);

            }
        });

        if (informacionAgrupadaFront) {

            informacionAgrupadaFront.forEach((insumo) => {
                let totalItemEmpresaPeso = 0;
                let totalItemEmpresaUnidades = 0;
                Object.values(insumo.detalleBodega).forEach((valores, key) => {
                    if (valores.peso > 0) {
                        totalItemEmpresaPeso += valores.peso;
                        totalItemEmpresaUnidades += valores.unidades;
                        valores.promedio = valores.peso / valores.unidades;
                    }
                });
                insumo.totalCompaniaPeso = totalItemEmpresaPeso;
                insumo.totalCompaniaUnidades = totalItemEmpresaUnidades;
                insumo.promedioGeneral = totalItemEmpresaPeso / totalItemEmpresaUnidades;
            });

            informacionAgrupadaFront.forEach(insumo => {

                if (insumo.totalCompaniaPeso > 0) {

                    insumosConInventario.push(insumo);

                } else {

                    /* NO RECUERDO PORQUE TENGO ESTO ACÁ PERO NO LO VOY A ELIMINAR XD                 
                if (insumo.totalCompaniaUnidades > 0 && insumo.totalCompaniaPeso === 0) {                 
                                }
                 */
                    insumosSinInventario.push(insumo);

                }
            });
        }

        if (detallesLineaFront) {

            /*  */
            detallesLineaFront.forEach(linea => {

                linea.detalleItemsLinea = Object.values(linea.detalleItemsLinea).sort((a, b) => {

                    if (a.peso > b.peso) {
                        return -1;
                    }

                    if (a.peso < b.peso) {
                        return 1;
                    }

                    return 0;
                });
            });

        }




        res.status(200).json({

            status: 200,
            body: {
                informacionAgrupadaFront: insumosConInventario,
                labelsLinea,
                valuesLinea,
                documentosEnTrasporte,
                bodegasDisponibles,
                detallesLineaFront,
                labelCombCriterios,
                kgCombCriterios,
                unidadesCombCriterios,
                totales,
                insumosSinInventario,
                transito: {
                    listo: estadoSt.listo,
                    enCurso: estadoSt.enCurso,
                    filas: estadoSt.filas.length,
                },

            },
        });
    } catch (error) {
        console.error("Error inventario compañía:", error.message || error);
        if (!res.headersSent) {
            return res.status(502).json({
                status: 502,
                body: { message: error.message || 'No se pudo consultar el inventario de la compañía.' },
                error: true,
            });
        }
    }

}

bodegaCtr.inventarioTransito = async (req, res) => {
    const filas = resumenSt().filas;
    const estadoSt = resumenSt();
    const totalesMov = kpisTransito(filas.filter((row) => esStInventarioCompania(row)));
    res.status(200).json({
        status: 200,
        body: {
            totales: totalesMov,
            documentosEnTrasporte: agruparDocumentosSt(filas),
            transito: {
                listo: estadoSt.listo,
                enCurso: estadoSt.enCurso,
                filas: filas.length,
            },
        },
    });
};

const bodegasGrupoEtc = (bodegas) => {
    const nombres = new Map();
    for (const bodega of Array.isArray(bodegas) ? bodegas : []) {
        const codigo = String(bodega.codigo || bodega.id_bodega || "").trim();
        const descripcion = String(bodega.descripcion || bodega.desc_bodega || "").trim();
        if (!codigo || !descripcion || descripcion.toUpperCase() === "INACTIVA") continue;
        nombres.set(normalizarCodigoBodega(codigo), descripcion);
    }
    return ordenarBodegasPorCodigo(
      CATALOGO_BODEGAS_ETC.map((item) => ({
        codigo: item.codigo,
        descripcion: nombres.get(normalizarCodigoBodega(item.codigo)) || item.descripcion,
      }))
    );
};

bodegaCtr.getBodegasInventarioctr = async (req, res) => {
    return res.status(200).json({
        status: 200,
        body: bodegasGrupoEtc([]),
        error: false,
    });
};

bodegaCtr.dashboardIndicadoresInventario = async (req, res) => {
    try {
        const body = await armarIndicadoresInventario();
        return res.status(200).json({
            status: 200,
            body,
            error: false,
        });
    } catch (error) {
        console.error("Dashboard indicadores:", error.message);
        return res.status(502).json({
            status: 502,
            body: { message: error.message || "No se pudieron armar los indicadores de inventario." },
            error: true,
        });
    }
};


export default bodegaCtr