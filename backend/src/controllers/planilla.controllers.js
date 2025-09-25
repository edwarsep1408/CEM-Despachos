import xlsx from "xlsx";
import mongoose, { Query, Types, Mongoose } from "mongoose";
import moment from "moment";
/* MODELS */

import planillaModel from "../models/planilla_mesa.models";
import FinalizaPlanillaModel from "../models/finalizar_planilla.models";
import colaboradorModel from "../models/personal.models";
import conteoModel from "../models/conteo.models";
import planillaEventModel from "../models/planilla_event.models";
import conteoDetails from "../models/conteoDetails.models";
import { format } from "morgan";
import mesaModels from "../models/mesa.models";
import { values } from "lodash";

const planillaCtr = {};

planillaCtr.postPlanilla = async (req, res) => {
  const body = req.body;

  try {
    const validacionMesa = await planillaModel.findOne({
      mesa: body.mesa,
      estado: 0,
    });

    if (validacionMesa) {
      return res.status(400).json({
        status: 400,
        body: { message: "La planilla ya esta registrada" },
        error: false,
      });
    }

    const planillaAnterior = await planillaModel
      .findOne({
        mesa: body.mesa,
        estado: 2,
      })
      .sort({ _id: -1 })
      .limit(1);

    let newDate = new Date();

    let data = {
      ...body,
      numero_planilla: planillaAnterior
        ? planillaAnterior.numero_planilla + 1
        : 1,
      mes: newDate.getMonth() + 1,
      ano: newDate.getFullYear(),
      dia: newDate.getDate(),
    };

    /* console.log(data);
    process.exit(0); */

    const newPlanilla = new planillaModel(data);

    const storagePlanilla = await newPlanilla.save();

    if (!storagePlanilla) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó la planilla" },
        error: false,
      });
    }

    let dataConteo = {
      planilla: storagePlanilla._id,
      bodega: body.bodega,
      mesa: body.mesa,
      numero_conteo: 1,
      total_conteos: 0,
    };

    const newConteo = new conteoModel(dataConteo);

    await newConteo.save();
    global.io.to(body.mesa).emit("nueva-planilla", storagePlanilla);
    return res.status(200).json({
      status: 200,
      body: storagePlanilla,
      error: false,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

planillaCtr.getPlanilla = async (req, res) => {
  const { mesa, bodega } = req.params;

  try {
    const planilla = await planillaModel
      .findOne({ mesa, bodega, estado: 0 })
      .populate("bodega")
      .populate("mesa");

    if (planilla === null) {
      res.status(404).json({
        status: 404,
        body: { message: "No se encontraron planilla" },
        error: false,
      });
    } else {
      res.status(200).json({
        status: 200,
        body: planilla,
        error: false,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

planillaCtr.postPlanillaFinaliza = async (req, res) => {
  const body = req.body;

  try {
    const newPlanilla = new FinalizaPlanillaModel(body);

    const storagePlanilla = await newPlanilla.save();

    if (!storagePlanilla) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó la planilla" },
        error: false,
      });
    }

    global.io.to(body.mesa).emit("nueva-firma-planilla", storagePlanilla);

    return res.status(200).json({
      status: 200,
      body: storagePlanilla,
      error: false,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

planillaCtr.getValidateFirmados = async (req, res) => {
  const { planilla, mesa } = req.params;

  try {
    // Obtener la lista de colaboradores para la mesa
    const colaboradores = await colaboradorModel.find({
      mesa,
      perfil: "Contador",
    });

    // Obtener la lista de colaboradores que ya han firmado
    const colaboradoresFirmados = await FinalizaPlanillaModel.find({
      planilla,
      mesa,
    }).populate("colaborador");

    // Verificar si todos los colaboradores han firmado
    const todosFirmaron = colaboradores.length === colaboradoresFirmados.length;

    // Calcular cuántos colaboradores aún no han firmado
    const faltanPorFirmar = todosFirmaron
      ? 0
      : colaboradores.length - colaboradoresFirmados.length;

    // Enviar respuesta según la condición
    if (todosFirmaron) {
      res.status(200).json({ mensaje: "Todos los colaboradores han firmado" });
    } else {
      res.status(404).json({
        status: 404,
        body: {
          colaboradoresFirmados,
          faltan: {
            colaboradores: colaboradores.length,
            faltanPorFirmar,
          },
        },
        error: false,
      });
    }
  } catch (error) {
    console.error("Error al validar firmas:", error);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
};

planillaCtr.getPlanillaResumen = async (req, res) => {
  try {
    const result = await conteoModel.aggregate([
      {
        $lookup: {
          from: "conteo-details",
          localField: "ultimoConteoDetails",
          foreignField: "_id",
          as: "conteoDetails",
        },
      },
      {
        $unwind: "$conteoDetails",
      },
      {
        $lookup: {
          from: "items",
          localField: "conteoDetails.producto",
          foreignField: "_id",
          as: "producto",
        },
      },
      {
        $unwind: "$producto",
      },
      {
        $lookup: {
          from: "bodegas",
          localField: "bodega",
          foreignField: "_id",
          as: "bodega",
        },
      },
      {
        $unwind: "$bodega",
      },
      {
        $group: {
          _id: "$producto._id",
          nombre_bodega: { $first: "$bodega.nombre" },
          codigo_bodega: { $first: "$bodega.codigo" },
          referencia: { $first: "$producto.referencia" },
          descripcion: { $first: "$producto.descripcion" },
          sum_numero_canastas: { $sum: "$conteoDetails.numero_canastas" },
          sum_numero_canastillas: { $sum: "$conteoDetails.numero_canastillas" },
          numero_bultos: { $sum: "$conteoDetails.numero_bultos" },
          numero_cajas: { $sum: "$conteoDetails.numero_cajas" },
          carreta: { $sum: "$conteoDetails.carreta" },
          kg_pesados: { $sum: "$conteoDetails.kg_pesados" },
          unidades_contadas: { $sum: "$conteoDetails.unidades_contadas" },
          kg_neto: { $sum: "$conteoDetails.kg_neto" },
        },
      },
    ]);

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron resumen de inventario" },
        error: false,
      });
    }

    res.status(200).json({
      status: 200,
      body: result,
      error: false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error interno del servidor");
  }
};

planillaCtr.getPlanillaResumenFilter = async (req, res) => {
  const { bodega, ano, fecha } = req.params;

  try {
    const matchStage = {};
    const query = {};

    if (bodega) {
      matchStage.bodega = new Types.ObjectId(bodega);
      query.bodega = bodega;
    }

    if (ano) {
      matchStage.ano = parseInt(ano);
    }

    if (fecha) {
      matchStage.fecha = fecha;
    }

    const resumenInventario = await conteoModel.aggregate([
      {
        $match: Object.keys(matchStage).length > 0 ? matchStage : {},
      },
      {
        $lookup: {
          from: "conteo-details",
          localField: "ultimoConteoDetails",
          foreignField: "_id",
          as: "conteoDetails",
        },
      },
      {
        $unwind: "$conteoDetails",
      },
      {
        $lookup: {
          from: "items",
          localField: "conteoDetails.producto",
          foreignField: "_id",
          as: "producto",
        },
      },
      {
        $unwind: "$producto",
      },
      {
        $lookup: {
          from: "bodegas",
          localField: "bodega",
          foreignField: "_id",
          as: "bodega",
        },
      },
      {
        $unwind: "$bodega",
      },
      {
        $lookup: {
          from: "mesas",
          localField: "mesa",
          foreignField: "_id",
          as: "mesa",
        },
      },
      {
        $unwind: "$mesa",
      },
      {
        $group: {
          _id: "$producto._id",
          nombre_bodega: { $first: "$bodega.nombre" },
          codigo_bodega: { $first: "$bodega.codigo" },
          mesa: { $first: "$mesa.nombre" },
          referencia: { $first: "$producto.referencia" },
          descripcion: { $first: "$producto.descripcion" },
          sum_numero_canastas: { $sum: "$conteoDetails.numero_canastas" },
          sum_numero_canastillas: { $sum: "$conteoDetails.numero_canastillas" },
          numero_bultos: { $sum: "$conteoDetails.numero_bultos" },
          numero_cajas: { $sum: "$conteoDetails.numero_cajas" },
          carreta: { $sum: "$conteoDetails.carreta" },
          kg_pesados: { $sum: "$conteoDetails.kg_pesados" },
          unidades_contadas: { $sum: "$conteoDetails.unidades_contadas" },
          kg_neto: { $sum: "$conteoDetails.kg_neto" },
        },
      },
    ]);

    const eventPlanilla = await planillaEventModel
      .find(Object.keys(query).length > 0 ? query : {})
      .populate("bodega")
      .populate("mesa")
      .populate("conteo");

    const conteo = await conteoModel
      .find(Object.keys(query).length > 0 ? query : {})
      .populate("ultimoConteoDetails");

    const sumas = {
      kg_pesados: 0,
      unidades_contadas: 0,
      numero_canastas: 0,
      numero_canastillas: 0,
      numero_bultos: 0,
      numero_cajas: 0,
      carreta: 0,
      kg_neto: 0,
    };

    for (const conteoItem of conteo) {
      const { ultimoConteoDetails } = conteoItem;

      if (ultimoConteoDetails) {
        // Iterar sobre las propiedades del objeto sumas y acumular los valores correspondientes
        Object.keys(sumas).forEach((prop) => {
          sumas[prop] += ultimoConteoDetails[prop];
        });
      }
    }

    res.status(200).json({
      status: 200,
      body: {
        resumenInventario,
        eventPlanilla,
        resumenGeneral: sumas,
      },
      error: false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error interno del servidor");
  }
};

planillaCtr.getPlanillaResumenFilterByPlanilla = async (req, res) => {
  const { bodega, ano, fecha } = req.params;

  try {
    let planillasDashboard = [];
    let fechaMasRecienteInventario = moment();
    let estadoInventario = "";
    let informacionMesas = [];
    let labels =[];
    let valuesPie =[];


    //VAMOS A BUSCAR PLANILLAS QUE TENGAN ESTADO 0, DE ACIERDO A ESO SE BUSCA EN LOS CONTEOS POR LAS PLANILLAS QUE TENGAN ESTADO 0
    const planillasActivas = await planillaModel.find({ estado: "0" });

    /* SI HAY INVENTARIOS EN CURSO VAMOS A LLENAR PLANILLADASHBOARD CON LA INFORMACIÓN DE PLANILLASACTIVAS */
    if (planillasActivas.length > 0) {
      estadoInventario = "En proceso";
      planillasActivas.forEach((element) => {

        planillasDashboard.push(element._id.toString());

      });

    }else{

      //SI NO BUSCAR INVENTARIO MÁS RECIENTE HECHO Y MOSTRAR LOS DATOS QUE PERTENECEN A ESE INVENTARIO
      //LA QUERY FILTRA LAS FECHAS EN ORDEN DESCENDIENTE (Mayor fecha a menor fecha)

      const fechaInventarioReciente = await planillaModel
        .find()
        .sort({ fecha_inventario: -1 })
        .then((result) => {
          if (result) {
            // SE GUARDA EL VALOR DE LA PRIMERA FECHA QUE APARECE YA QUE ES LA FECHA DEL INVENTARIO MÁS RECIENTE
            fechaMasRecienteInventario = result[0].fecha_inventario;
            estadoInventario = "Finalizado";

            //DENTRO DEL FOR SE VALIDA QUE LAS FECHAS QUE TIENEN EL VALOR DE "fechaMasRecienteInventario" SE GUARDA EL _ID DE LA PLANILLA EN PLANILLADASHBOARD

            for (let coleccion = 0; coleccion < result.length; coleccion++){
              if (
                fechaMasRecienteInventario.getTime() ===
                result[coleccion].fecha_inventario.getTime()
              ) {
                planillasDashboard.push(result[coleccion]._id.toString());
              }
            }
          } 
          
          return planillasDashboard;
        });
    }
    
    /* Acá llamo la función que se encarga de traer los valores del pie (es decir los productos con más pesaje en el inventario) */
    [labels, valuesPie] = await planillaCtr.productosConMayorCantidadPie(planillasDashboard);
      
    /* SE CONSULTA LA INFORMACIÓN RELACIONADA CON LA MESA, SE SUMA LOS KILOS PESADOS Y LAS UNIDADES 
       PARA MOSTRARLA EN EL DASHBOARD
    */
    const informacionAgrupadaporMesa = await conteoModel
      .aggregate([
        {
          $lookup: {
            from: "conteo-details",
            localField: "ultimoConteoDetails",
            foreignField: "_id",
            as: "conteoDetails",
          },
        },
        {
          $unwind: "$conteoDetails",
        },
        {
          $match: {
            "conteoDetails.planilla": {
              $in: planillasDashboard.map(
                (planilla) => new Types.ObjectId(planilla)
              ),
            },
          },
        },
        {
          $lookup: {
            from: "mesas",
            localField: "mesa",
            foreignField: "_id",
            as: "mesa",
          },
        },
        {
          $unwind: "$mesa",
        },
        {
          $group: {
            _id: "$mesa._id",
            mesa: { $first: "$mesa.nombre" },
            kg_pesados: { $sum: "$conteoDetails.kg_neto" },
            unidades_contadas: { $sum: "$conteoDetails.unidades_contadas" },
            kg_neto: { $sum: "$conteoDetails.kg_neto" },
          },
        },
      ])
      .then((result) => {
        informacionMesas = result;
        return informacionMesas;
      });

      
    /* SE HACE LA QUERY POR CONTEOS, SE ASOCIA BODEGA, CONTEODETAILS, PRODUCTO Y MESAS, SE FILTRA POR LOS VALORES DE PLANILLADASHBOARD, 
    YA SEA INVENTARIO EN PROCESO O ÚLTIMO INVENTARIO 
    ESTA QUERY SE AGRUPA POR EL ID DEL CONTEO YA QUE EL CONTEO SE NECESITA MOSTRAR. 
    */

    const resumenInventario = await conteoModel
      .aggregate([
        {
          $lookup: {
            from: "conteo-details",
            localField: "ultimoConteoDetails",
            foreignField: "_id",
            as: "conteoDetails",
          },
        },
        {
          $unwind: "$conteoDetails",
        },
        {
          $match: {
            "conteoDetails.planilla": {
              $in: planillasDashboard.map(
                (planilla) => new Types.ObjectId(planilla)
              ),
            },
          },
        },
        {
          $lookup: {
            from: "items",
            localField: "conteoDetails.producto",
            foreignField: "_id",
            as: "producto",
          },
        },
        {
          $unwind: "$producto",
        },
        {
          $lookup: {
            from: "bodegas",
            localField: "bodega",
            foreignField: "_id",
            as: "bodega",
          },
        },
        {
          $unwind: "$bodega",
        },
        {
          $lookup: {
            from: "mesas",
            localField: "mesa",
            foreignField: "_id",
            as: "mesa",
          },
        },
        {
          $unwind: "$mesa",
        },
        {
          $group: {
            _id: "$_id",
            nombre_bodega: { $first: "$bodega.nombre" },
            codigo_bodega: { $first: "$bodega.codigo" },
            mesa: { $first: "$mesa.nombre" },
            referencia: { $first: "$producto.referencia" },
            descripcion: { $first: "$producto.descripcion" },
            numero_conteo: { $first: "$numero_conteo" },
            sum_numero_canastas: { $first: "$conteoDetails.numero_canastas" },
            sum_numero_canastillas: {
              $first: "$conteoDetails.numero_canastillas",
            },
            numero_bultos: { $first: "$conteoDetails.numero_bultos" },
            numero_cajas: { $first: "$conteoDetails.numero_cajas" },
            carreta: { $first: "$conteoDetails.carreta" },
            kg_pesados: { $first: "$conteoDetails.kg_pesados" },
            unidades_contadas: { $first: "$conteoDetails.unidades_contadas" },
            kg_neto: { $first: "$conteoDetails.kg_neto" },
          },
        },
      ])
      .then((rest) => {
        
        /* SE CREA UNA VARIABLE CON LOS VALORES A SUMAR PARA ACUMULAR LOS VALORES. SE SUMAN LOS VALORES DE LA QUERY */
        
        const eventPlanilla = [];
        let informacionInventario = {};
        
        /* Se le asigna timezone UTC, para que tome la fecha del día de hoy. Ya que si no se le asigna UTC a veces al consultar las fechas le quita un día y no concuerda la información */
        let dateFormatStart = moment.utc(fechaMasRecienteInventario);
                
        const sumas = {
          kg_pesados: 0,
          unidades_contadas: 0,
          numero_canastas: 0,
          numero_canastillas: 0,
          numero_bultos: 0,
          numero_cajas: 0,
          carreta: 0,
          kg_neto: 0,
        };

        if (Array.isArray(rest) && rest.length > 0) {
          
          informacionInventario = {
            codigo_bodega: rest[0].codigo_bodega,
            nombre_bodega: rest[0].nombre_bodega,
            estadoInventario: estadoInventario,
            fechaMasRecienteInventario:  dateFormatStart.format("DD-MM-YYYY"),
          };

          rest.forEach((item) => {
            sumas.kg_pesados += item.kg_pesados;
            sumas.kg_neto += item.kg_neto;
            sumas.unidades_contadas += item.unidades_contadas;
            sumas.numero_canastas += item.sum_numero_canastas;
            sumas.numero_canastillas += item.sum_numero_canastillas;
            sumas.numero_bultos += item.numero_bultos;
            sumas.numero_cajas += item.numero_cajas;
            sumas.carreta += item.carreta;
          });

          res.status(200).json({
            status: 200,
            message:true,
            body: {
              resumenInventario: rest,
              eventPlanilla,
              resumenGeneral: sumas,
              informacionInventario,
              informacionMesas,
              labelsPie : labels ,
              valPie: valuesPie
            },
          });

        }else if(Array.isArray(rest) && rest.length === 0){

          /* Esta validación se hizo con el fin de elimiar el error de que si hay una planilla abierta sin información no se genere error si no que muestre qué planilla abierta hay 
          y proceder a cerrarla (se tenía problemas con planillas abiertas sin información asociada )
          */
          
          let planillaNoInformacion=[]; 
          const planillasActivasSinInformacion =  planillaModel.find({ estado: "0" });

          planillasActivasSinInformacion.then((respta) => {

          /*  planillasDashboard.push(element._id.toString()); */
          /* Guardar las planillas activas sin informacion en un array */

          respta.forEach((element, index)=> {

            planillaNoInformacion.push(element._id);

          });
          
          /* TRaer la bodega y el nombre de la mesa para mostrarle al usuario las mesas abiertas */

          planillaModel.aggregate([
            {
             $lookup : {
              from: "mesas",
              localField : "mesa",
              foreignField : "_id",
              as : "mesasInformation"
             } ,
            },
            {
              $unwind: "$mesasInformation"
            },
            {
              $lookup : {
                from : "bodegas",
                localField : "bodega",
                foreignField: "_id",
                as : "bodega"
              },
            },
            {
              $unwind: "$bodega"
            },
            {
              $match : {  
                  "_id" : {
                    $in : planillaNoInformacion.map(
                      (planillaEmpty) => planillaEmpty
                    )
                  }
              }
            },
            {
              $group : {
                _id: "$_id",
                mesas: { $first: "$mesasInformation.nombre" },
                bodegas: { $first: "$bodega.nombre" },
                fecha_inventario : { $first : "$fecha_inventario"  }
              }
            },
            {
              $addFields: {
                fecha_inventario_formato : {
                  $dateToString : {                    
                    format: "%d-%m-%Y",
                    date: "$fecha_inventario",
                  }
                }
              }
            }
          ]).then( mesasSinInformacion => {

             console.log("ANTES DE ROTORNAR");
            
             res.status(200).json({
              status:200,
              message : false,
              body: {
                infoPlanillaSinInformacion : mesasSinInformacion
              }

            });
          })
          });

          /* res.status(500).send({message:' Por favor validar que todas las planillas estén cerradas '}); */

        }
      });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error interno del servidor");
  }
};

planillaCtr.getExcelInventario = async (req, res) => {
  
  const { bodega, ano, fecha } = req.params;
  const fechaNew = new Date(fecha);

  /* 
  bodega: bodega,
  ano: parseInt(ano),
  fecha_inventario: fechaNew, 
  
  original del proyecto*/

  try {
    const planillas = await planillaModel.find({
      bodega: bodega,
      ano: parseInt(ano),
      fecha_inventario: fechaNew,
    });

    if (!planillas || planillas.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron resumen de inventario" },
        error: false,
      });
    }
    8;

    const query = {
      planilla: { $in: planillas.map((item) => new Types.ObjectId(item._id)) },
    };

    /* console.log("-------------------------", query, "-----------------------------");
    
    process.exit(); */

    const result = await conteoModel.aggregate([
      {
        $lookup: {
          from: "conteo-details",
          localField: "ultimoConteoDetails",
          foreignField: "_id",
          as: "conteoDetails",
        },
      },
      {
        $unwind: "$conteoDetails",
      },
      {
        $lookup: {
          from: "items",
          localField: "conteoDetails.producto",
          foreignField: "_id",
          as: "producto",
        },
      },
      {
        $unwind: "$producto",
      },
      {
        $lookup: {
          from: "bodegas",
          localField: "bodega",
          foreignField: "_id",
          as: "bodega",
        },
      },
      {
        $unwind: "$bodega",
      },
      {
        $lookup: {
          from: "mesas",
          localField: "mesa",
          foreignField: "_id",
          as: "mesa",
        },
      },
      {
        $unwind: "$mesa",
      },

      {
        $group: {
          _id: "$producto._id",
          nombre_bodega: { $first: "$bodega.nombre" },
          codigo_bodega: { $first: "$bodega.codigo" },
          mesa: { $first: "$mesa.nombre" },
          referencia: { $first: "$producto.referencia" },
          descripcion: { $first: "$producto.descripcion" },
          sum_numero_canastas: { $sum: "$conteoDetails.numero_canastas" },
          sum_numero_canastillas: { $sum: "$conteoDetails.numero_canastillas" },
          numero_bultos: { $sum: "$conteoDetails.numero_bultos" },
          numero_cajas: { $sum: "$conteoDetails.numero_cajas" },
          carreta: { $sum: "$conteoDetails.carreta" },
          kg_pesados: { $sum: "$conteoDetails.kg_pesados" },
          unidades_contadas: { $sum: "$conteoDetails.unidades_contadas" },
          kg_neto: { $sum: "$conteoDetails.kg_neto" },
        },
      },
    ]);

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron planilla" },
        error: false,
      });
    }
    const workSheetColumnName = [
      "Codigo",
      "Descripcion",
      "Suma de Kilos Netos",
      "Suma de Unidades",
      "Promedio",
    ];

    const data = result.map((item) => {
      return [
        item.referencia,
        item.descripcion,
        item.kg_neto,
        item.unidades_contadas,
        (item.kg_neto / item.unidades_contadas).toFixed(2),
      ];
    });

    const workSheetData = [workSheetColumnName, ...data];

    // Crear el libro de trabajo y agregar la hoja de cálculo
    const workbook = xlsx.utils.book_new();
    const workSheet = xlsx.utils.aoa_to_sheet(workSheetData);
    const date = new Date();
    const nameFile = `${date.getFullYear()}${date.getDate()}${date.getMonth()}`;
    xlsx.utils.book_append_sheet(workbook, workSheet, nameFile);

    // Configurar la respuesta HTTP para descargar el archivo
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=archivo.xlsx");

    // Convertir el libro de trabajo a un buffer y enviar como respuesta
    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al generar el archivo Excel" });
  }
};

planillaCtr.getResumenGeneral = async (req, res) => {
  const { planilla } = req.params;

  try {
    const conteo = await conteoModel
      .find({ planilla })
      .populate("ultimoConteoDetails");

    let suma_kilos = 0;
    let suma_unidades = 0;
    let numero_canastas = 0;
    let numero_canastillas = 0;
    let numero_bultos = 0;
    let numero_cajas = 0;
    let carreta = 0;
    let kg_neto = 0;

    for (const conteoItem of conteo) {
      if (conteoItem.ultimoConteoDetails) {
        suma_kilos += conteoItem.ultimoConteoDetails.kg_pesados;
        suma_unidades += conteoItem.ultimoConteoDetails.unidades_contadas;
        numero_canastas += conteoItem.ultimoConteoDetails.numero_canastas;
        numero_canastillas += conteoItem.ultimoConteoDetails.numero_canastillas;
        numero_bultos += conteoItem.ultimoConteoDetails.numero_bultos;
        numero_cajas += conteoItem.ultimoConteoDetails.numero_cajas;
        carreta += conteoItem.ultimoConteoDetails.carreta;
        kg_neto += conteoItem.ultimoConteoDetails.kg_neto;
      }
    }

    if (conteo.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontró ningún resumen" },
        error: false,
      });
    }

    res.status(200).json({
      status: 200,
      body: {
        suma_kilos,
        suma_unidades,
        numero_canastas,
        numero_canastillas,
        numero_bultos,
        numero_cajas,
        carreta,
        kg_neto,
      },
      error: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error interno del servidor");
  }
};

planillaCtr.getEventPlanilla = async (req, res) => {
  const { planilla, mesa } = req.params;

  try {
    const eventPlanilla = await planillaEventModel.find({ planilla, mesa });

    if (eventPlanilla.length === 0) {
      res.status(404).json({
        status: 404,
        body: { message: "No hay eventos" },
        error: false,
      });
      return;
    }

    res.status(200).json({
      status: 200,
      body: eventPlanilla,
      error: false,
    });
  } catch (error) {
    console.log(error);
  }
};

planillaCtr.getYearFilter = async (req, res) => {
  const { bodega } = req.params;

  const result = await planillaModel.aggregate([
    {
      $match: {
        bodega: new Types.ObjectId(bodega),
      },
    },
    {
      $group: {
        _id: "$null",
        ano: { $first: "$ano" },
      },
    },
  ]);

  if (result.length == 0) {
    return res.status(404).json({
      status: 404,
      body: { message: "No se encontraron resultados" },
      error: false,
    });
  }

  res.status(200).json({
    status: 200,
    body: result,
    error: false,
  });
};

planillaCtr.getMonthFilter = async (req, res) => {
  const { ano, bodega } = req.params;

  const result = await planillaModel.aggregate([
    {
      $match: {
        bodega: new Types.ObjectId(bodega),
        ano: parseInt(ano),
      },
    },
    {
      $group: {
        _id: "$null",
        fecha_inventario: { $first: "$fecha_inventario" },
      },
    },
  ]);

  if (result.length == 0) {
    return res.status(404).json({
      status: 404,
      body: { message: "No se encontraron resultados" },
      error: false,
    });
  }

  res.status(200).json({
    status: 200,
    body: result,
    error: false,
  });
};

planillaCtr.getEventPlanB = async (req, res) => {
  const { bodega, mesa } = req.params;

  try {
    const events = await planillaEventModel.find({ bodega, mesa });

    if (events.length == 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron resultados" },
        error: false,
      });
    }

    res.status(200).json({
      status: 200,
      body: events,
      error: false,
    });
  } catch (error) {
    console.error(err);
    res.status(500).send("Error interno del servidor");
  }
};

planillaCtr.getPlanillasPorBodega = async (req, res) => {
  const bodegaId = req.query.bodega;
  const formatQuery = new mongoose.Types.ObjectId(bodegaId);
  const allData = [];

  const results = await planillaModel
    .aggregate([
      {
        $match: {
          bodega: formatQuery,
        },
      },
      {
        $addFields:{
          fecha_inventario_dia:{
            $dateToString:{
              format: "%Y-%m-%d",
              date:"$fecha_inventario"
            }
          }
        }
      },
      {
        $group: {
          //_id: { $dateTrunc: { date: "$fecha_inventario", unit: "day" } }, //agrupar por este campo  linea original mongo veresion 7
          
          _id: "$fecha_inventario" , //agrupar por este campo  $gte:["$fecha_inventario", date]
          docs: { $push: "$$ROOT" }, //mantener las colecciones oiriginales en el campo docs
        },
      },
    ])
    .then((respuestaQuery) => {
      if (respuestaQuery) {
        /*
        - Se crea el foreach  para formatear la fecha de creación del inventario para mostrar la opción al usuario
        - Moment utc se hace para cambiar el localtime y al formatear la fecha obtener 0
        */
       console.log("------------------------------------------------");
        
        respuestaQuery.forEach((item) => {
          item.docs.forEach((docValue) => {
            console.log(docValue, "M");
            
            let dateFormatStart = moment.utc(docValue.fecha_inventario);
            docValue.fecha_formateada = dateFormatStart.format("DD/MM/YYYY");
          });
          allData.push(...item.docs);
        });
        
        console.log(allData, " DESPUES DE PROCESADA ");

        res.json({ success: allData });
      } else {
        res.json({ error: "No hay información para esta bodega.   " });
      }
    })
    .catch((err) => {
      res.json({ error: err.message + " Por favor contactar desarrollador" });
    });
};

planillaCtr.getInventarioPorPlanillaBodega = async (req, res) => {
  const { planilla, bodega, fecha_inventario } = req.params;

  /* Se formatea los valores para proceder a consultar en la BD */
  const formatQueryBodega = new Types.ObjectId(bodega);
  const formatQueryPlanilla = new Types.ObjectId(planilla);
  const date = new Date(fecha_inventario);
  const fecha_formateada = date.toISOString();
  let planillasAsociadasInventario = [];

  
  
  try {
    
    /* let getPlanillas = await planillaModel 
      .aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$bodega", formatQueryBodega] },
                {
                  $eq: [
                    { $dateTrunc: { date: "$fecha_inventario", unit: "day" } },
                    { $dateTrunc: { date: date, unit: "day" } },
                  ],
                },
              ],
            },
          },
        },
      ]) */
    /* Se contultan los valores asociados a la bodega y fecha, esta fecha solo involucra las planillas que se crearon el mismo día mes y año. */
    let getPlanillas = await planillaModel 
      .aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$bodega", formatQueryBodega] },
                {
                  $gte:["$fecha_inventario", date]
                },
              ],
            },
          },
        },
      ])
      .then((respta) => {
        
        if (respta) {
          /*Se extraen los valores del _id para proceder a buscar en la colección conteo-details las planillas que están asociados al inventario con las fechas seleccionadas */
          for (let collection = 0; collection < respta.length; collection++) {
            planillasAsociadasInventario.push(
              respta[collection]._id.toString()
            );
          }

          const result = conteoModel
            .aggregate([
              {
                $lookup: {
                  from: "conteo-details",
                  localField: "ultimoConteoDetails",
                  foreignField: "_id",
                  as: "conteoDetails",
                },
              },
              {
                $unwind: "$conteoDetails",
              },
              {
                $match: {
                  "conteoDetails.bodega": formatQueryBodega,
                  "conteoDetails.planilla": {
                    $in: planillasAsociadasInventario.map(
                      (plani) => new Types.ObjectId(plani)
                    ),
                  },
                },
              },
              {
                $lookup: {
                  from: "items",
                  localField: "conteoDetails.producto",
                  foreignField: "_id",
                  as: "producto",
                },
              },
              {
                $unwind: "$producto",
              },
              {
                $lookup: {
                  from: "bodegas",
                  localField: "bodega",
                  foreignField: "_id",
                  as: "bodega",
                },
              },
              {
                $unwind: "$bodega",
              },
              {
                $lookup: {
                  from: "mesas",
                  localField: "mesa",
                  foreignField: "_id",
                  as: "mesa",
                },
              },
              {
                $unwind: "$mesa",
              },

              {
                $group: {
                  _id: "$producto._id",
                  nombre_bodega: { $first: "$bodega.nombre" },
                  codigo_bodega: { $first: "$bodega.codigo" },
                  mesa: { $first: "$mesa.nombre" },
                  referencia: { $first: "$producto.referencia" },
                  descripcion: { $first: "$producto.descripcion" },
                  id_planilla: { $first: "$conteoDetails.planilla" },
                  sum_numero_canastas: { $sum: "$conteoDetails.numero_canastas", },
                  sum_numero_canastillas: { $sum: "$conteoDetails.numero_canastillas", },
                  numero_bultos: { $sum: "$conteoDetails.numero_bultos" },
                  numero_cajas: { $sum: "$conteoDetails.numero_cajas" },
                  carreta: { $sum: "$conteoDetails.carreta" },
                  kg_pesados: { $sum: "$conteoDetails.kg_pesados" },
                  unidades_contadas: { $sum: "$conteoDetails.unidades_contadas",},
                  kg_neto: { $sum: "$conteoDetails.kg_neto" },
                },
              },
            ])
            .then((respInventario) => {
              if (respInventario) {
                const workSheetColumnName = [
                  "Consecutivo",
                  "Bodega",
                  "Suma de Kilos Netos",
                  "Suma de Unidades",
                  "Referencia"
                ];

                /*
                TITLES COLUMNS (primera version)
                "Codigo",
                  "Descripcion",
                  "Suma de Kilos Netos",
                  "Suma de Unidades",
                  "Promedio", */

                const data = respInventario.map((item) => {
                  return [
                    "",
                    item.codigo_bodega,
                    item.kg_neto,
                    item.unidades_contadas,
                    item.referencia,
                  ];
                });
                /*
                VALORES REALES EXCEL (primera version)
                item.referencia,
                item.descripcion,
                item.kg_neto,
                item.unidades_contadas,
                (item.kg_neto / item.unidades_contadas).toFixed(2), */

                const workSheetData = [workSheetColumnName, ...data];
                //Crear el libro de trabajo y agregar la hoja de cálculo
                const workbook = xlsx.utils.book_new();
                const workSheet = xlsx.utils.aoa_to_sheet(workSheetData);
                const date = new Date();
                const nameFile = `${date.getFullYear()}${date.getDate()}${date.getMonth()}`;

                xlsx.utils.book_append_sheet(workbook, workSheet, nameFile);

                //Configurar la respuesta HTTP para descargar el archivo

                res.setHeader(
                  "Content-Type",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
                res.setHeader(
                  "Content-Disposition",
                  "attachment; filename=archivo.xlsx"
                );

                //Convertir el libro de trabajo a un buffer y enviar como respuesta
                const buffer = xlsx.write(workbook, {
                  bookType: "xlsx",
                  type: "buffer",
                });
                res.end(buffer);
              } else {
                res.json({ error: "No se encontraron resultados" });
              }
            });
        }
      });
  } catch (error) {
    res.json({ error: error.message });
  }
};

planillaCtr.getInventarioRevisoriaFiscal = async (req, res) => {
  const { planilla, bodega, fecha_inventario } = req.params;

  /* Se formatea los valores para proceder a consultar en la BD */
  const formatQueryBodega = new Types.ObjectId(bodega);
  const formatQueryPlanilla = new Types.ObjectId(planilla);
  const date = new Date(fecha_inventario);
  const fecha_formateada = date.toISOString();
  let planillasAsociadasInventario = [];

  try {
    /* Se contultan los valores asociados a la bodega y fecha, esta fecha solo involucra las planillas que se crearon el mismo día mes y año. */

    let getPlanillas = await planillaModel
      .aggregate([
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ["$bodega", formatQueryBodega],
                },
                {
                  $gte: [
                    "$fecha_inventario", date
                  ],
                },
              ],
            },
          },
        },
      ])
      .then((resptaPlanillas) => {
        if (resptaPlanillas) {
          for (
            let coleccion = 0;
            coleccion < resptaPlanillas.length;
            coleccion++
          ) {
            planillasAsociadasInventario.push(
              resptaPlanillas[coleccion]._id.toString()
            );
          }

          const result = conteoModel
            .aggregate([
              {
                $lookup: {
                  from: "conteo-details",
                  localField: "ultimoConteoDetails",
                  foreignField: "_id",
                  as: "conteoDetails",
                },
              },
              {
                $unwind: "$conteoDetails",
              },
              {
                $match: {
                  "conteoDetails.bodega": formatQueryBodega,
                  "conteoDetails.planilla": {
                    $in: planillasAsociadasInventario.map(
                      (plani) => new Types.ObjectId(plani)
                    ),
                  },
                },
              },
              {
                $lookup: {
                  from: "items",
                  localField: "conteoDetails.producto",
                  foreignField: "_id",
                  as: "producto",
                },
              },
              {
                $unwind: "$producto",
              },
              {
                $lookup: {
                  from: "bodegas",
                  localField: "bodega",
                  foreignField: "_id",
                  as: "bodega",
                },
              },
              {
                $unwind: "$bodega",
              },
              {
                $lookup: {
                  from: "mesas",
                  localField: "mesa",
                  foreignField: "_id",
                  as: "mesa",
                },
              },
              {
                $unwind: "$mesa",
              },

              {
                $project: {
                  _id: "$producto._id",
                  nombre_bodega: "$bodega.nombre",
                  codigo_bodega: "$bodega.codigo",
                  mesa: "$mesa.nombre",
                  referencia: "$producto.referencia",
                  descripcion: "$producto.descripcion",
                  id_planilla: "$conteoDetails.planilla",
                  numero_canastas: "$conteoDetails.numero_canastas",
                  numero_canastillas: "$conteoDetails.numero_canastillas",
                  numero_bultos: "$conteoDetails.numero_bultos",
                  numero_cajas: "$conteoDetails.numero_cajas",
                  carreta: "$conteoDetails.carreta",
                  kg_pesados: "$conteoDetails.kg_pesados",
                  unidades_contadas: "$conteoDetails.unidades_contadas",
                  kg_neto: "$conteoDetails.kg_neto",
                },
              },
            ])
            .then((respInventario) => {
              if (respInventario) {
                const workSheetColumnName = [
                  "Codigo",
                  "Descripcion producto",
                  "Mesa",
                  "Kilos Netos",
                  "Kilos pesados",
                  "Unidades",
                  "Canastas",
                  "Canastillas",
                  "Bultos",
                  "Cajas",
                  "Carreta",
                ];
                const data = respInventario.map((item) => {
                  return [
                    item.referencia,
                    item.descripcion,
                    item.mesa,
                    item.kg_neto,
                    item.kg_pesados,
                    item.unidades_contadas,
                    item.numero_canastas,
                    item.numero_canastillas,
                    item.numero_bultos,
                    item.numero_cajas,
                    item.carreta,
                  ];
                });

                

                const workSheetData = [workSheetColumnName, ...data];
                //Crear el libro de trabajo y agregar la hoja de cálculo
                const workbook = xlsx.utils.book_new();
                const workSheet = xlsx.utils.aoa_to_sheet(workSheetData);
                const date = new Date();
                const nameFile = `${date.getFullYear()}${date.getDate()}${date.getMonth()}`;

                xlsx.utils.book_append_sheet(workbook, workSheet, nameFile);

                //configurar la respuesta HTTP para descargar el archivo

                res.setHeader(
                  "Content-Type",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
                res.setHeader(
                  "Content-Disposition",
                  "attachment; filename=archivo.xlsx"
                );

                // Convertir el libro de trabajo a un buffer y enviar como respuesta
                const buffer = xlsx.write(workbook, {
                  bookType: "xlsx",
                  type: "buffer",
                });
                res.end(buffer);
              
              }
            });
        } else {
          res.json({ error: "No se encontraron resultados" });
        }
      });
  } catch (error) {}
};

planillaCtr.getInventarioDetalladomesayconteo = async(req, res) => {

  const { planilla, bodega, fecha_inventario } = req.params;

  /* Se formatea los valores para proceder a consultar en la BD */
  const formatQueryBodega = new Types.ObjectId(bodega);
  const formatQueryPlanilla = new Types.ObjectId(planilla);
  const date = new Date(fecha_inventario);
  const fecha_formateada = date.toISOString();
  let planillasAsociadasInventario = [];
 

  try {
    
        /* Se contultan los valores asociados a la bodega y fecha, esta fecha solo involucra las planillas que se crearon el mismo día mes y año. */

        let getPlanillas = await planillaModel
        .aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$bodega", formatQueryBodega],
                  },
                  {
                    $gte: [
                      "$fecha_inventario", date
                    ],
                  },
                ],
              },
            },
          },
        ])
        .then((resptaPlanillas) => {

          if (resptaPlanillas) {
            for (let coleccion = 0;coleccion < resptaPlanillas.length; coleccion++) {

              planillasAsociadasInventario.push(resptaPlanillas[coleccion]._id.toString());

            } 
            return planillasAsociadasInventario;
          }
        })
        


     /* SE CONSULTA LA INFORMACIÓN RELACIONADA CON LA MESA, SE SUMA LOS KILOS PESADOS Y LAS UNIDADES 
       PARA MOSTRARLA EN EL DASHBOARD
    */

       const resumenInventario = await conteoModel
       .aggregate([
         {
           $lookup: {
             from: "conteo-details",
             localField: "ultimoConteoDetails",
             foreignField: "_id",
             as: "conteoDetails",
           },
         },
         {
           $unwind: "$conteoDetails",
         },
         {
           $match: {
             "conteoDetails.planilla": {
               $in: planillasAsociadasInventario.map(
                 (planilla) => new Types.ObjectId(planilla)
               ),
             },
           },
         },
         {
           $lookup: {
             from: "items",
             localField: "conteoDetails.producto",
             foreignField: "_id",
             as: "producto",
           },
         },
         {
           $unwind: "$producto",
         },
         {
           $lookup: {
             from: "bodegas",
             localField: "bodega",
             foreignField: "_id",
             as: "bodega",
           },
         },
         {
           $unwind: "$bodega",
         },
         {
           $lookup: {
             from: "mesas",
             localField: "mesa",
             foreignField: "_id",
             as: "mesa",
           },
         },
         {
           $unwind: "$mesa",
         },
         {
           $group: {
             _id: "$_id",
             nombre_bodega: { $first: "$bodega.nombre" },
             codigo_bodega: { $first: "$bodega.codigo" },
             mesa: { $first: "$mesa.nombre" },
             referencia: { $first: "$producto.referencia" },
             descripcion: { $first: "$producto.descripcion" },
             numero_conteo: { $first: "$numero_conteo" },
             sum_numero_canastas: { $first: "$conteoDetails.numero_canastas" },
             sum_numero_canastillas: {
               $first: "$conteoDetails.numero_canastillas",
             },
             numero_bultos: { $first: "$conteoDetails.numero_bultos" },
             numero_cajas: { $first: "$conteoDetails.numero_cajas" },
             carreta: { $first: "$conteoDetails.carreta" },
             kg_pesados: { $first: "$conteoDetails.kg_pesados" },
             unidades_contadas: { $first: "$conteoDetails.unidades_contadas" },
             kg_neto: { $first: "$conteoDetails.kg_neto" },
           },
         },
       ])
       .then((result) => {

        if (result) {
          const workSheetColumnName = [
            "Codigo",
            "Descripcion",
            "Mesa",
            "#-Conteo",
            "Kilos Netos",
            "Kilos pesados",
            "Unidades",
            "Canastas",
            "Canastillas",
            "Bultos",
            "Cajas",
            "Carreta",
          ];

          const data = result.map((item) => {
            return [
              item.referencia,
              item.descripcion,
              item.mesa,
              item.numero_conteo,
              item.kg_neto,
              item.kg_pesados,
              item.unidades_contadas,
              item.sum_numero_canastas,
              item.sum_numero_canastillas,
              item.numero_bultos,
              item.numero_cajas,
              item.carreta,
            ]
          });
          
          const workSheetData = [workSheetColumnName, ...data];
          //Crear el libro de trabajo y agregar la hoja de cálculo
          const workbook = xlsx.utils.book_new();
          const workSheet = xlsx.utils.aoa_to_sheet(workSheetData);
          const date = new Date();
          const nameFile = `${date.getFullYear()}${date.getDate()}${date.getMonth()}`;

          xlsx.utils.book_append_sheet(workbook, workSheet, nameFile);

          //configurar la respuesta HTTP para descargar el archivo

          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader(
            "Content-Disposition",
            "attachment; filename=archivo.xlsx"
          );

          // Convertir el libro de trabajo a un buffer y enviar como respuesta
          const buffer = xlsx.write(workbook, {
            bookType: "xlsx",
            type: "buffer",
          });
          res.end(buffer);
        }
       }) 
  } catch (error) {
    
  }


}

planillaCtr.productosConMayorCantidadPie = async (planillas) => {

/* ESta función se creo para  mostrar en el pie del dashboard los productos con mayor inventario en  */

let labels= [];
let valuesPie=[];

/* Hacemos la query para consultar los productos con más valores de kg en el inventario. PAra esto agrupamos los productos por ID, sumamos las cantidades y se agrupa por kg_neto en orden descendiente. */
const result = await conteoModel.aggregate([
  {
    $lookup: {
      from: "conteo-details",
      localField: "ultimoConteoDetails",
      foreignField: "_id",
      as: "conteoDetails",
    },
  },
  {
    $unwind: "$conteoDetails",
  },
  {
    $match: {
      "conteoDetails.planilla": {
        $in: planillas.map(
          (plani) => new Types.ObjectId(plani)
        ),
      },
    },
  },
  {
    $lookup: {
      from: "items",
      localField: "conteoDetails.producto",
      foreignField: "_id",
      as: "producto",
    },
  },
  {
    $unwind: "$producto",
  },
  {
    $lookup: {
      from: "bodegas",
      localField: "bodega",
      foreignField: "_id",
      as: "bodega",
    },
  },
  {
    $unwind: "$bodega",
  },
  {
    $lookup: {
      from: "mesas",
      localField: "mesa",
      foreignField: "_id",
      as: "mesa",
    },
  },
  {
    $unwind: "$mesa",
  },

  {
    $group: {
      _id: "$producto._id",
      nombre_bodega: { $first: "$bodega.nombre" },
      referencia: { $first: "$producto.referencia" },
      descripcion: { $first: "$producto.descripcion" },
      kg_pesados: { $sum: "$conteoDetails.kg_pesados" },
      kg_neto: { $sum: "$conteoDetails.kg_neto" },
    },
  },
  {
    $sort: {kg_neto: -1} /* Ordenar la query de manera descendente, de mayor a menor */
  }
]).then((respta) => {

  if (respta.length > 0) {
/* Después validamos que la variable tenga información y hacemos un foreach donde traemos los primeros 5 valores (más peso tienen, por el orden descendiente de kg_neto) */
    for (let index = 0; index < respta.length; index++) {

      if (index <= 4) {
        labels.push(respta[index].referencia+' '+respta[index].descripcion);
        valuesPie.push(respta[index].kg_neto);         
      }

    }

  }

  return [labels, valuesPie];
})
  return [labels, valuesPie];

}


export default planillaCtr;

