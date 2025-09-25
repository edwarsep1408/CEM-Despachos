import itemsModel from "../models/items.models";
import sincronizacionesModel from "../models/sincronizaciones.model";
import axios from "axios";
import { parseString } from "xml2js";
import path from "path";
import { readFileSync } from "fs";
import xlsx from "xlsx";
import { log } from "console";

const itemsCtr = {};

/* const url = "http://192.168.1.2/wsConsultasUnoEE_Ventas/wsConsultaGT.asmx";

const soapRequest = `
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <EjecutarConsultaFiltradaUnoEE xmlns="http://www.generictransfer.com/">
    <Usuario>CarnicosGT</Usuario>
    <Clave>*Carnicos2013*.</Clave>
    <Consulta>NConsultaMaestroItems</Consulta>
    <Filtro></Filtro>
    </EjecutarConsultaFiltradaUnoEE>
  </soap12:Body>
</soap12:Envelope>

`;
itemsCtr.getSincronizarItemsSiesa = async (req, res) => {
  try {
    const itemsMaestro = await itemsModel.find();

    const response = await axios.post(url, soapRequest, {
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
      },
    });

    const xmlResponse = response.data;

    parseString(
      xmlResponse,
      { explicitArray: false, ignoreAttrs: true },
      async (err, result) => {
        if (err) {
          console.error("Error de conversión de XML a JSON:", err);
        } else {
          const items =
            result["soap:Envelope"]["soap:Body"]
              .EjecutarConsultaFiltradaUnoEEResponse
              .EjecutarConsultaFiltradaUnoEEResult["diffgr:diffgram"]
              .NConsultaMaestroItems.Table;

          const syncPromises = [];

          const filteredItems = items.filter(
            (item) =>
              item.ESTADO === "1" &&
              [
                "INV143503",
                "INV143502",
                "INV143502G",
                "INV143502T",
                "INVSUB",
              ].includes(item.IDTIPOINVENTARIO.trim())
          );

          for (const externalItem of filteredItems) {
            const existingItem = itemsMaestro.find(
              (item) => item.codigoItem === externalItem.CODIGOITEM
            );

            if (!existingItem) {
              // Create a new item in your MongoDB database
              const newItem = new itemsModel({
                item: externalItem.ITEM,
                codigoItem: externalItem.CODIGOITEM,
                referencia: externalItem.REFERENCIA.split("\n")
                  .map((line) => line.trim())
                  .join(" "),
                descripcion: externalItem.DESCRIPCION,
                descCorta: externalItem.DESCCORTA,
                idTipoinventario: externalItem.IDTIPOINVENTARIO.split("\n")
                  .map((line) => line.trim())
                  .join(" "),
                descTipoInventario: externalItem.DESCTIPOINVENTARIO,
                undInventario: externalItem.UNDINVENTARIO,
                undAdicional: externalItem.UNDADICIONAL,
                linea: externalItem.LINEA,
                combinacion: externalItem.COMBINACION,
                estado: externalItem.ESTADO,
              });

              await newItem.save();

              syncPromises.push(
                Promise.resolve(`Item ${externalItem.CODIGOITEM} synchronized.`)
              );
            }
          }

          await Promise.all(syncPromises);
        }
      }
    );

    res.status(200).json({
      status: 200,
      body: { message: "Sincronización de datos exitosa." },
      error: false,
    });
  } catch (error) {
    console.error("Error en la sincronización de datos:", error);
    // Handle the error and send an appropriate response
    res.status(500).json({
      status: 200,
      body: { message: "Error Interno del Servidor" },
      error: true,
    });
  }
}; */

itemsCtr.sincronizacionItemsExcel = async (req, res) => {
  const nombreArchivo = req.file;

  const rutaArchtivo = path.join(
    __dirname,
    "../tmp/files",
    nombreArchivo.filename
  );

  try {
    const workbook = xlsx.readFile(rutaArchtivo);
    const sheetName = workbook.SheetNames[0]; // Suponiendo que solo hay una hoja en el archivo
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    const valoresNoREgistrados = [];
    /*  */
    for (let i of data) {
      const itemsMaestro = await itemsModel.findOne({
        referencia: i.Refere,

      });

      if (!itemsMaestro) {
        valoresNoREgistrados.push(i.Refere.toString());
      }
    }

    const response = await axios.post(url, soapRequest, {
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
      },
    });

    console.log(valoresNoREgistrados, "val");
    const xmlResponse = response.data;

    parseString(
      xmlResponse,
      { explicitArray: false, ignoreAttrs: true },
      async (err, result) => {
        if (err) {
          console.error("Error de conversión de XML a JSON:", err);
        } else {
          const items =
            result["soap:Envelope"]["soap:Body"]
              .EjecutarConsultaFiltradaUnoEEResponse
              .EjecutarConsultaFiltradaUnoEEResult["diffgr:diffgram"]
              .NConsultaMaestroItems.Table;

          const syncPromises = [];

          const filteredItems = items.filter(
            (item) =>
              valoresNoREgistrados.includes(item.REFERENCIA.trim())
          );

          for (const externalItem of filteredItems) {

            // Create a new item in your MongoDB database
            const newItem = new itemsModel({
              item: externalItem.ITEM,
              codigoItem: externalItem.CODIGOITEM,
              referencia: externalItem.REFERENCIA.split("\n")
                .map((line) => line.trim())
                .join(" "),
              descripcion: externalItem.DESCRIPCION,
              descCorta: externalItem.DESCCORTA,
              idTipoinventario: externalItem.IDTIPOINVENTARIO.split("\n")
                .map((line) => line.trim())
                .join(" "),
              descTipoInventario: externalItem.DESCTIPOINVENTARIO,
              undInventario: externalItem.UNDINVENTARIO,
              undAdicional: externalItem.UNDADICIONAL,
              linea: externalItem.LINEA,
              combinacion: externalItem.COMBINACION,
              estado: externalItem.ESTADO,
            });

            await newItem.save();

            syncPromises.push(
              Promise.resolve(`Item ${externalItem.CODIGOITEM} synchronized.`)
            );

          }

          await Promise.all(syncPromises);
        }
      }
    );
    // Aquí puedes hacer lo que necesites con los datos
    res.status(200).json({
      status: 200,
      body: { message: "Sincronización de datos exitosa." },
      error: false,
    });
  } catch (error) {
    console.error("Error al leer el archivo de Excel:", error);
    res.status(500).send("Ocurrió un error al leer el archivo de Excel.");
  }
};

itemsCtr.getItems = async (req, res) => {
  try {
    const items = await itemsModel.find();

    if (items.length === 0) {
      res.status(404).json({
        status: 404,
        body: { message: "No se encontraron items" },
        error: false,
      });
    } else {
      res.status(200).json({
        status: 200,
        body: items,
        error: false,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

itemsCtr.getSearchItem = async (req, res) => {
  const { searchTerm } = req.body;

  try {
    const items = await itemsModel.find({
      $or: [
        { referencia: { $regex: searchTerm, $options: "i" } },
        { descripcion: { $regex: searchTerm, $options: "i" } },
      ],
    });
    if (items.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron items" },
        error: false,
      });
    }

    res.status(200).json({
      status: 200,
      body: items,
      error: false,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al realizar la búsqueda." });
  }
};

itemsCtr.SincronizarReferenciasUnoee = async (req, res) => {

  console.log("Iniciando sincronización de referencias unoee...");
  if (!req.query.usuario) {

    console.log("Faltó el usuario que ejecutó la sincronización. Sincronización cancelada.");

    return res.status(400).json({

      status: 400,
      body: { message: "El usuario es obligatorio" },
      error: true,

    });

  }

  try {

    let nuevosRegistros = 0;
    let registrosActualizados = 0;
    let referenciasActualizadas = [];

    const response = await axios.get('https://servicios.siesacloud.com/api/connekta/v3.1/ejecutarconsulta?idCompania=55&descripcion=carnicosyalimentos_GET_ITEMS&paginacion=numPag=1|tamPag=100', {
      headers: {

        "Content-Type": "application/json",
        "ConniKey": "aa74be9840e91d6dbba9728b0e61a68e",
        "ConniToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjZjZTU1N2JmLWRmYjMtNDM3ZC1hMDEyLTQ3YzEyZjE3Zjc4MyIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcHJpbWFyeXNpZCI6ImNkOWNlY2JhLTJhOWEtNDdhZC1hODkyLWJkZjE0MTAyYmUxYiJ9.fV7jAmDIz5JqaLGqIbhSGC3zKzkh2Lok4t6yBK5WIxc",

      }
    });


    const items = response.data?.detalle?.Table || [];

    if (items.length === 0) {

      return res.status(400).json({

        status: 400,
        body: { message: "No se encontraron datos" },
        error: false,

      });
    }
    console.log("Procesando...");

    for (const element of items) {

      const existeItem = await itemsModel.findOne({ referencia: element.id_item, codigoItem: element.codigo_item, referencia: element.referencia.trim() }).lean();


      let estadoItemLocal = existeItem ? Number(existeItem.estado) : 0;

      /* validar si el item no existe lo crea, pero si el ITEM existe y no tiene el mismo estado de sistema 1 lo actualiza  */
      if (!existeItem) {

        /* si no existe el item lo guarda */
        const nuevoItem = new itemsModel({

          item: element.id_item,
          codigoItem: element.codigo_item,
          referencia: element.referencia ? element.referencia.trim() : '',
          descripcion: element.descripcion ? element.descripcion.trim() : '',
          descCorta: element.descCorta ? element.descCorta.trim() : '',
          idTipoinventario: element.tipo_inventario,
          descTipoInventario: element.desc_tipo_inventario,
          undInventario: element.unidad_medida_1 ? element.unidad_medida_1.trim() : '',
          undAdicional: element.unidad_medida_2 ? element.unidad_medida_2.trim() : '',
          linea: '',
          estado: element.estado,
          combinacion: '',

        });
        const guardarItem = await nuevoItem.save();
        if (guardarItem._id) {
          nuevosRegistros += 1;
        }

      } else if (estadoItemLocal !== element.estado) {

        /* Si el estado es diferente, se actualiza en el sistema el item */

        const actualizarItem = await itemsModel.findByIdAndUpdate(existeItem._id, { estado: element.estado }, { new: true });
        referenciasActualizadas.push(actualizarItem.referencia);
        if (actualizarItem._id) {
          registrosActualizados += 1;
        }

      }
    }

    const nuevaSincronizacion = new sincronizacionesModel({

      nombre_sincronizacion: 'items',
      descripcion_sincronizacion: `Sincronización de referencias unoee, completada con éxito `,
      estado_sincronizacion: 'Finalizado',
      usuario_iniciador: req.query.usuario,
      total_items_nuevos: nuevosRegistros,
      total_actualizaciones: registrosActualizados,

    });

    const guardarSincronizacion = await nuevaSincronizacion.save();

    if (guardarSincronizacion._id) {
      console.log("Proceso finalizado con éxito : ");
      console.log("referencias actualizadas ", referenciasActualizadas, "Referencias creadas ", nuevosRegistros);


      return res.status(200).json({

        status: 200,
        body: { message: "Sincronización de datos exitosa.", total_nuevos_registros: nuevosRegistros, registros_actualizados: registrosActualizados },
        error: false,

      });
    }


  } catch (error) {
    console.error("Error en la sincronización de datos:", error);

  }

}

itemsCtr.informacionUltimaSincronizacionItems = async (req, res) => {

  try {

    const ultimaSincronizacion = await sincronizacionesModel.findOne({ nombre_sincronizacion: 'items' }).sort({ fecha_sincronizacion: -1 });
    
    return res.status(200).json({

      status: 200,
      body: ultimaSincronizacion,
      error: false,

    });

  } catch (error) {
    console.error(error);

  }

}

export default itemsCtr;
