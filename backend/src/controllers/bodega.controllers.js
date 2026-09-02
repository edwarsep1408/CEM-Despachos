import bodegaModel from '../models/bodega.models'
import axios from "axios";
import mongoose from 'mongoose';
import inventario_real from '../models/inventario_real';
import pedidosModel from '../models/pedidos.models';
import siesaPedidos from '../services/siesaPedidos.servicios';
import { sincronizarCatalogoBodegas } from '../services/siesaBodegas.servicios';
import { consultarExistenciasPorBodega, consultarExistenciasCompania, fuenteExistenciasCem } from '../services/siesaExistencias.servicios';
import { consultarExistenciasCemPorBodega, consultarExistenciasCemCompania, consultarStCem } from '../services/cemInventario.servicios';
import { consultarDocumentosStSiesa, programarRefrescoSt, resumenSt, kpisTransito, agruparDocumentosSt } from '../services/siesaSt.servicios';

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
        try {
            await sincronizarCatalogoBodegas(bodegaModel);
        } catch (syncError) {
            console.error("Sync bodegas SIESA:", syncError.message);
        }
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
    fuenteExistenciasCem()
        ? consultarStCem()
        : consultarDocumentosStSiesa().catch((error) => {
            console.error("ST Connekta:", error.message);
            return [];
        });

const TIPOS_INVENTARIO_BODEGA = new Set([
    'INV143502',
    'INV143502G',
    'INV143502T',
    'INV143503',
    'INVSUBEX',
    'INVCANASTA',
    'INV143501',
]);

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
                    const descripcionLinea = respuesta[index].descripcion_linea !== null ? respuesta[index].descripcion_linea.trim() : null;
                    const idLinea = respuesta[index].id_linea !== null ? respuesta[index].id_linea.trim() : null;
                    const id_comb_criterio = respuesta[index].id_comb_criter !== null ? respuesta[index].id_comb_criter.trim() : null;

                    if (!tipo_inventario || TIPOS_INVENTARIO_BODEGA.has(tipo_inventario)) {

                        const { referencia, descripcion, unidad_medida_1, unidad_medida_2, Existencia_1, Existencia_2, abc_rotacion_veces, id_linea, descripcion_linea, id_comb_criter, descrip_comb_criter } = respuesta[index];

                        if (respuesta[index].descripcion === 'CANASTAS' || respuesta[index].descripcion === 'CANASTILLAS') {

                            if (respuesta[index].descripcion === 'CANASTAS') {

                                canastas = Existencia_1;

                            } else {

                                canastillas = Existencia_1;
                            }
                        } else {

                            if (respuesta[index].Existencia_1 === 0 && respuesta[index].Existencia_2 === 0) {

                                productosSinInventario.push({ 'referencia': referencia, 'descripcion': descripcion, 'unidad_medida_1': unidad_medida_1, 'Existencia_1': Existencia_1, 'unidad_medida_2': unidad_medida_2, 'Existencia_2': Existencia_2, 'abc_rotacion_veces': abc_rotacion_veces });

                            } else {

                                productosConInventario.push({ 'referencia': referencia, 'descripcion': descripcion, 'unidad_medida_1': unidad_medida_1, 'Existencia_1': Existencia_1, 'unidad_medida_2': unidad_medida_2, 'Existencia_2': Existencia_2, 'abc_rotacion_veces': abc_rotacion_veces, 'id_linea': id_linea, 'descripcion_linea': descripcion_linea, 'id_comb_criter': id_comb_criter, 'descrip_comb_criter': descrip_comb_criter });
                                if (Existencia_1 > 0) {

                                    totalPeso += Existencia_1;
                                    totalUnidades += Existencia_2;

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

                    const id_linea = productosConInventario[index].id_linea !== null ? productosConInventario[index].id_linea.trim() : null;
                    const descripcionLinea = productosConInventario[index].descripcion_linea !== null ? productosConInventario[index].descripcion_linea.trim() : null;
                    const descrip_comb_criter = productosConInventario[index].descrip_comb_criter !== null ? productosConInventario[index].descrip_comb_criter.trim() : null;
                    const id_comb_criter = productosConInventario[index].id_comb_criter !== null ? productosConInventario[index].id_comb_criter.trim() : null;

                    if (descripcionLinea !== null && descripcionLinea != 'CANASTAS' && descripcionLinea != 'CANASTILLAS') {

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
                dataLinea = valoresLineaOrganizados.map(([, value]) => value);

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
    let entransporteOrdenado = {};
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
        const [infoBodegasCargada, infoEnTransitoCargada] = await Promise.all([
            leerExistenciasCompania(),
            fuenteExistenciasCem()
                ? consultarStCem()
                : consultarDocumentosStSiesa(esperaStMs).catch((error) => {
                    console.error("ST Connekta:", error.message);
                    return [];
                }),
        ]);
        infoBodegas = Array.isArray(infoBodegasCargada) ? infoBodegasCargada : [];
        const infoEnTransito = Array.isArray(infoEnTransitoCargada) ? infoEnTransitoCargada : [];

        /* INICIALIZAR LOS VALORES DE LAS VARIABLES */

        infoBodegas.forEach(element => {
            const tipo_inventario = String(element.tipo_inventario || "").trim();
            if (
                tipo_inventario === 'INV143502'
                || tipo_inventario === 'INV143502G'
                || tipo_inventario === 'INV143502T'
                || tipo_inventario === 'INV143503'
                || tipo_inventario === 'INVSUBEX'
                || tipo_inventario === 'INVSUB'
                || tipo_inventario === 'INV143501'
            ) {
                /* hacer trim para eliminar espacios */
                const referencia = String(element.referencia || "").trim();
                const codigo_bodega = String(element.codigo_bodega || "").trim();
                if (!referencia || !codigo_bodega) return;
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
            }
        });

        /* Tomar las bodegas donde hay productos  */
        const bodegas = [];
        infoBodegas.forEach(element => {

            const codig_bodeg = String(element.codigo_bodega || "").trim();
            if (codig_bodeg && !bodegas[codig_bodeg]) {
                bodegas[codig_bodeg] = {
                    id_bodega: codig_bodeg,
                    desc_bodega: String(element.descripcion_bodega || "").trim() || codig_bodeg
                };
            }
        });


        const infoBodegasProceso = Object.values(bodegas);
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

            const tipo_inventario = String(element.tipo_inventario || "").trim();
            if (
                tipo_inventario === 'INV143502'
                || tipo_inventario === 'INV143502G'
                || tipo_inventario === 'INV143502T'
                || tipo_inventario === 'INV143503'
                || tipo_inventario === 'INVSUBEX'
                || tipo_inventario === 'INVSUB'
                || tipo_inventario === 'INV143501'
            ) {
                /* trim para eliminar espacios */
                const referencia = String(element.referencia || "").trim();
                const codigo_bodega = String(element.codigo_bodega || "").trim();
                if (!referencia || !codigo_bodega) return;
                const nombreLinea = element.descripcion_linea === null ? 'novalue' : element.descripcion_linea.trim();
                const cantidad = element.Existencia_1;
                const cantidadUnidades = element.Existencia_2;
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

        /* Agregar cantidades de la bodega en tránsito a la bodega que llega */
        infoEnTransito.forEach(element => {
            /* hacer trim para eliminar espacios vacios */
            /* Se cuenta la cantidad de productos en la bodega que entra  */
            const referencia = String(element.referencia_item || "").trim();
            const codigo_bodega = String(element.codigo_bodega_ent || "").trim();
            const cantidad = Number(element.cant_saldo_1) || 0;
            const nombreLinea = element.descripcion_linea == null ? 'novalue' : String(element.descripcion_linea).trim();
            const cantidadUnidades = Number(element.cant_saldo_2) || 0;
            if (!referencia) return;
            if (!informacionAgrupada[referencia]) {
                informacionAgrupada[referencia] = {
                    referencia: referencia,
                    descripcion: element.descripcion,
                    rotacion: 'no',
                    detalleBodega: {}
                };
            }

            /* Si los valores no están definidos se INICIALIZAN, SI NO se procede a hacer la suma  */
            const refInfo = informacionAgrupada[referencia];
            if (!refInfo.detalleBodega[codigo_bodega]) {
                refInfo.detalleBodega[codigo_bodega] = { peso: 0, unidades: 0 }
            }
            if (referencia === 'CANASTAS' || referencia === 'CANASTILLAS') {

                referencia === 'CANASTAS' ? canastasEnMovimiento += cantidad : canastillasEnMovimiento += cantidad;

            } else {

                informacionAgrupada[referencia].detalleBodega[codigo_bodega].peso += cantidad;
                informacionAgrupada[referencia].detalleBodega[codigo_bodega].unidades += cantidadUnidades;
                totalKgCompania += cantidad;
                /* totalUnidadesCompania+=cantidadUnidades; */
                totalKgMovimiento += cantidad;
                totalUnidadesMovimiento += cantidadUnidades;
            }
        });

        /* Darle formato a números lineaProductos */
        const formatoNumeros = new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        /* Hacer promedio de referencia por unidad en cada bodega y totalizar las cantidades de referencia en todas las bodegas */
        infoEnTransito.map((val) => {
            if (!entransporteOrdenado[val.consec_docto]) {
                entransporteOrdenado[val.consec_docto] = {
                    consec_docto: val.consec_docto,
                    tipo_docto: val.tipo_docto,
                    codigo_bodega_sal: val.codigo_bodega_sal,
                    bodega_sal: val.bodega_sal,
                    codigo_bodega_ent: val.codigo_bodega_ent,
                    bodega_ent: val.bodega_ent,
                    notas: val.notas,
                    detalles: []
                }
            }

            const detallesConsec_dcto = {
                referencia_item: val.referencia_item,
                descripcion_item: val.descripcion_item,
                cant_salida: val.cant_salida,
                estado_frio: val.estado_frio,
                cant_saldo_2: val.cant_saldo_2
            }

            entransporteOrdenado[val.consec_docto].detalles.push({ detallesConsec_dcto });
        });

        /* Convertir objeto en array para trabajarlo con ngfor en el frontend  */
        const bodegasDisponibles = [...infoBodegasProceso];
        const documentosEnTrasporte = Object.values(entransporteOrdenado);
        const informacionAgrupadaFront = Object.values(informacionAgrupada);
        const detallesLineaFront = Object.values(detallesLinea);
        const totales = { totalKgCompania, totalUnidadesCompania, totalKgMovimiento, totalUnidadesMovimiento, canastasEnMovimiento, canastillasEnMovimiento };
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
                    listo: infoEnTransito.length > 0,
                    enCurso: estadoSt.enCurso,
                    filas: infoEnTransito.length,
                },

            },
        });
        programarRefrescoSt();
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
    programarRefrescoSt();
    const filas = resumenSt().filas;
    const estadoSt = resumenSt();
    const totalesMov = kpisTransito(filas);
    res.status(200).json({
        status: 200,
        body: {
            totales: totalesMov,
            documentosEnTrasporte: agruparDocumentosSt(filas),
            transito: {
                listo: filas.length > 0,
                enCurso: estadoSt.enCurso,
                filas: filas.length,
            },
        },
    });
};

bodegaCtr.getBodegasInventarioctr = async (req, res) => {

    try {

        const consultarBodegas = await axios.get(`${CEM_INVENTARIO_API}/get-bodegas-cia/${SIESA_ID_CIA}`, { timeout: INVENTARIO_TIMEOUT_MS });
        /* Despues de tener la petición leer las bodegas enviarla al front para que las bodegas sean dinámicas y no fijas.  */
        let infoBodegas = [];
        let bodegas = Array.isArray(consultarBodegas.data.body) ? consultarBodegas.data.body : [];

        if (bodegas) {

            bodegas.map((bodega) => {
                
                let codigo_bodega = bodega.codigo.trim();

                if (codigo_bodega.startsWith('P')) {
                
                    
                    infoBodegas.push({
                        codigo: codigo_bodega,
                        descripcion: bodega.descripcion.trim(),
                    });
                }

            });
        }

        return res.status(200).json({
            status: 200,
            body: infoBodegas,
            error: false
        });
    } catch (error) {

        console.error("Error al consultar las bodegas", error.message);
        try {
            const pedidos = await pedidosModel.find({}).lean();
            const mapa = new Map();
            for (const pedido of pedidos) {
                const lineas = siesaPedidos.lineasDePedido(pedido);
                const { bodega } = siesaPedidos.resolverBodegaPedido(pedido, lineas);
                const codigo = String(bodega || "").trim();
                if (codigo) mapa.set(codigo, { codigo, descripcion: codigo });
            }
            const locales = await bodegaModel.find({ estado: 0 }).lean();
            for (const row of locales) {
                const codigo = String(row.codigo || "").trim();
                if (codigo && !mapa.has(codigo)) {
                    mapa.set(codigo, { codigo, descripcion: row.nombre || codigo });
                }
            }
            const body = Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
            if (body.length) {
                return res.status(200).json({
                    status: 200,
                    body,
                    error: false,
                    aviso: "Inventario CEM (5015) no respondió; bodegas tomadas de pedidos y catálogo local.",
                });
            }
        } catch (fallbackError) {
            console.error("Fallback bodegas:", fallbackError.message);
        }
        return res.status(502).json({
            status: 502,
            body: [],
            error: true,
            message: 'No se pudieron consultar las bodegas en el servicio CEM (5015).',
        });

    }

};


export default bodegaCtr