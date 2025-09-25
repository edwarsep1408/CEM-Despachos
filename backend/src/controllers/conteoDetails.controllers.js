import { Types } from "mongoose";

import conteoModel from "../models/conteo.models";
import conteoDetailsModels from "../models/conteoDetails.models";
import conteoDetailsModel from "../models/conteoDetails.models";
import planillaLogsModel from "../models/planilla_logs.models";
import planillaEvent from "../models/planilla_event.models";
import lodash, { difference } from "lodash";
import correcionConteoAdminModel from "../models/conteo_correccion_admin.model";
import personalModel from "../models/personal.models";

const conteoCtr = {};

function isDataDifferent(data1, data2) {
  return !lodash.isEqual(data1, data2);
}

conteoCtr.postConteo = async (req, res) => {
  const body = req.body;

  try {
    const conteoDetailsAnterior = await conteoDetailsModel
      .findOne({
        planilla: body.planilla,
        conteo: body.conteo,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);
    {
    }

    if (
      conteoDetailsAnterior &&
      new Types.ObjectId(conteoDetailsAnterior.colaborador).toString() ==
        new Types.ObjectId(body.colaborador).toString()
    ) {
      return res.status(404).json({
        status: 404,
        body: {
          message:
            "Para llevar a cabo el segundo recuento, debe ser un digitador distinto.",
        },
        error: false,
      });
    }

    const conteoAnterior = await conteoModel
      .findOne({
        planilla: body.planilla,
        mesa: body.mesa,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

    if (conteoAnterior.total_conteos === 0) {
      global.io.to(body.mesa).emit("peso-anterior-falla", { error: true });
    }

    var totalConteos = conteoDetailsAnterior
      ? conteoDetailsAnterior.numero_conteo + 1
      : 1;

    let data = {
      ...body,
      kg_neto:
        parseFloat(body.kg_pesados) -
        parseFloat(body.numero_canastas) * 2 -
        parseFloat(body.numero_canastillas) * 1.5 -
        parseFloat(body.carreta),
      numero_conteo: totalConteos,
    };

    const newConteoDetails = new conteoDetailsModel(data);
    const storageConteoDetails = await newConteoDetails.save();

    await conteoModel.findByIdAndUpdate(body.conteo, {
      ultimoConteoDetails: storageConteoDetails._id,
      total_conteos: totalConteos,
    });

    if (conteoDetailsAnterior) {
      let dataDb = {
        producto: conteoDetailsAnterior.producto.toString(),
        numero_canastas: conteoDetailsAnterior.numero_canastas,
        numero_canastillas: conteoDetailsAnterior.numero_canastillas,
        numero_bultos: conteoDetailsAnterior.numero_bultos,
        numero_cajas: conteoDetailsAnterior.numero_cajas,
        carreta: conteoDetailsAnterior.carreta,
        kg_pesados: conteoDetailsAnterior.kg_pesados,
        unidades_contadas: conteoDetailsAnterior.unidades_contadas,
      };

      let dataBody = {
        producto: body.producto,
        numero_canastas: parseFloat(body.numero_canastas),
        numero_canastillas: parseFloat(body.numero_canastillas),
        numero_bultos: parseFloat(body.numero_bultos),
        numero_cajas: parseFloat(body.numero_cajas),
        carreta: parseFloat(body.carreta),
        kg_pesados: parseFloat(body.kg_pesados),
        unidades_contadas: parseFloat(body.unidades_contadas),
      };

      console.log(dataDb, dataBody);

      var areObjectsEqual = isDataDifferent(dataDb, dataBody);
    }

    console.log(areObjectsEqual);

    if (!storageConteoDetails) {
      return res.status(404).json({
        status: 404,
        body: { message: "Conteo no registrado" },
        error: false,
      });
    }

    global.io.to(body.mesa).emit("actualizar-conteo", { actualizar: true });
    global.io.emit("actualizar-conteo-admin", { actualizar: true });

    /*  await conteoModel.findByIdAndUpdate(body.conteo, { total_conteos: totalConteos + 1 }); */

    console.log(areObjectsEqual);

    if (areObjectsEqual) {
      const saveLogs = new planillaLogsModel({
        planilla: body.planilla,
        bodega: body.bodega,
        mesa: body.mesa,
        accion: "diferencia",
      });

      saveLogs.save();

      await new planillaEvent({
        planilla: body.planilla,
        bodega: body.bodega,
        mesa: body.mesa,
        conteo: body.conteo,
        nombreEvento: "Diferencia",
        evento: { type: "Diferencia", status: true },
      }).save();

      global.io.to(body.mesa).emit("diferencia", { differenceData: true });
      return res.status(200).json({
        status: 200,
        body: storageConteoDetails,
        error: false,
      });
    }

    if (storageConteoDetails.numero_conteo >= 2) {
      console.log("PRUEBA CONTEO", conteoAnterior.numero_conteo);
      let dataConteo = {
        planilla: body.planilla,
        bodega: body.bodega,
        mesa: body.mesa,
        producto: body.producto,
        numero_conteo: conteoAnterior.numero_conteo + 1,
        total_conteos: 0,
      };
      const newConteo = new conteoModel(dataConteo);

      await newConteo.save();
    }

    const saveLogs = new planillaLogsModel({
      planilla: body.planilla,
      bodega: body.bodega,
      mesa: body.mesa,
      accion: "correcto",
    });

    saveLogs.save();

    return res.status(200).json({
      status: 200,
      body: storageConteoDetails,
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

conteoCtr.getConteo = async (req, res) => {
  const { planilla_id, mesa } = req.params;

  try {
    const conteo = await conteoModel
      .findOne({
        planilla: planilla_id,
        mesa,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);
    if (conteo == null) {
      res.status(404).json({
        status: 404,
        body: { message: "No se encontraron conteo" },
        error: false,
      });
    } else {
      res.status(200).json({
        status: 200,
        body: conteo,
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

conteoCtr.getPlanillaLogs = async (req, res) => {
  const { planilla_id } = req.params;
  try {
    // Supongamos que tienes un campo 'correcto' que indica si la acción es correcta o no
    const logsCorrectos = await planillaLogsModel.find({
      planilla: planilla_id,
      accion: "correcto",
    });

    // Supongamos que las diferencias se registran con un campo 'correcto' que indica que no es correcto
    const diferencias = await planillaLogsModel.find({
      planilla: planilla_id,
      accion: "diferencia",
    });

    res.status(200).json({
      status: 200,
      body: {
        logsCorrectos: logsCorrectos.length,
        diferencias: diferencias.length,
      },
      error: false,
    });
  } catch (error) {
    console.error("Error al obtener logs:", error);
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

conteoCtr.getConteoResumen = async (req, res) => {
  const { bodega, mesa, planilla } = req.params;

  const conteos = await conteoModel
    .find({ bodega, mesa, planilla })
    .sort({ _id: -1 })
    .limit(3);

  if (conteos.length === 0) {
    return res.status(404).json({
      status: 404,
      body: { message: "No se encontraron conteo" },
      error: false,
    });
  }

  res.status(200).json({
    status: 200,
    body: conteos,
    error: false,
  });
};

conteoCtr.getConteoResumenDashboard = async (req, res) => {
  const { bodega, mesa } = req.params;

  const conteos = await conteoModel
    .find({ bodega, mesa })
    .sort({ _id: -1 })
    .populate("planilla");

  if (conteos.length === 0) {
    return res.status(404).json({
      status: 404,
      body: { message: "No se encontraron conteo" },
      error: false,
    });
  }

  res.status(200).json({
    status: 200,
    body: conteos,
    error: false,
  });
};

conteoCtr.getConteoDetailsResumen = async (req, res) => {
  const { conteo } = req.params;
  
  try {
    const conteos = await conteoDetailsModels
      .find({ conteo })
      .populate("producto")
      .populate("conteo")
      .populate("colaborador")

    if (conteos.length === 0) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se encontraron conteo" },
        error: false,
      });
    }
    
    res.status(200).json({
      status: 200,
      body: conteos,
      error: false,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

conteoCtr.postDiferenciaConteo = async (req, res) => {
  const body = req.body;

  try {
    const conteoDetailsAnterior = await conteoDetailsModel
      .findOne({
        planilla: body.planilla,
        conteo: body.conteo,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

    let data = {
      ...body,
      kg_neto:
        parseFloat(body.kg_pesados) -
        parseFloat(body.numero_canastas) * 2 -
        parseFloat(body.numero_canastillas) * 1.5 -
        parseFloat(body.carreta),
      numero_conteo: conteoDetailsAnterior
        ? conteoDetailsAnterior.numero_conteo + 1
        : 1,
    };

    const newConteoDetails = new conteoDetailsModel(data);

    const storageConteoDetails = await newConteoDetails.save();

    if (!storageConteoDetails) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó el conteo" },
        error: false,
      });
    }

    const conteoAnterior = await conteoModel
      .findOne({
        planilla: body.planilla,
        mesa: body.mesa,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

    let dataConteo = {
      planilla: body.planilla,
      bodega: body.bodega,
      mesa: body.mesa,
      producto: body.producto,
      numero_conteo: conteoAnterior.numero_conteo + 1,
      total_conteos: 0,
    };
    const newConteo = new conteoModel(dataConteo);

    await newConteo.save();

    await conteoModel.findByIdAndUpdate(
      { _id: body.conteo },
      {
        ultimoConteoDetails: storageConteoDetails._id,
        total_conteos: conteoDetailsAnterior
          ? conteoDetailsAnterior.numero_conteo + 1
          : 1,
      }
    );

    await planillaEvent.findOneAndDelete({
      nombreEvento: "Diferencia",
      mesa: body.mesa,
    });

    global.io.to(body.mesa).emit("diferencia", { differenceData: false });
    global.io.to(body.mesa).emit("actualizar-conteo", newConteo);
    global.io.emit("actualizar-conteo-admin", newConteo);
    res.status(200).json({
      status: 200,
      body: storageConteoDetails,
      error: false,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

conteoCtr.postCorreccionConteo = async (req, res) => {
  
  console.log(req.body);
  const body = req.body;
  
  
  try {
    const conteoDetailsAnterior = await conteoDetailsModel
      .findOne({
        planilla: body.planilla,
        conteo: body.conteo,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

      console.log(body, "111");
      
    let data = {
      ...body,
      kg_neto:
        parseFloat(body.kg_pesados) -
        parseFloat(body.numero_canastas) * 2 -
        parseFloat(body.numero_canastillas) * 1.5 -
        parseFloat(body.carreta),
      numero_conteo: conteoDetailsAnterior
        ? conteoDetailsAnterior.numero_conteo + 1
        : 1,
    };

      console.log(data, "222222");

    
    const newConteoDetails = new conteoDetailsModel(data);

    const storageConteoDetails = await newConteoDetails.save();

    if (!storageConteoDetails) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó el conteo" },
        error: false,
      });
    }

    await conteoModel.findByIdAndUpdate(
      { _id: body.conteo },
      {
        ultimoConteoDetails: storageConteoDetails._id,
        total_conteos: conteoDetailsAnterior
          ? conteoDetailsAnterior.numero_conteo + 1
          : 1,
      }
    );

    res.status(200).json({
      status: 200,
      body: storageConteoDetails,
      error: false,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

/* conteoCtr.postCorreccionConteo = async (req, res) => {
  const body = req.body;

  try {
    const conteoDetailsAnterior = await conteoDetailsModel
      .findOne({
        planilla: body.planilla,
        conteo: body.conteo,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

    let data = {
      ...body,
      kg_neto:
        parseFloat(body.kg_pesados) -
        parseFloat(body.numero_canastas) * 2 -
        parseFloat(body.numero_canastillas) * 1.5 -
        parseFloat(body.carreta),
      numero_conteo: conteoDetailsAnterior
        ? conteoDetailsAnterior.numero_conteo + 1
        : 1,
    };

    const newConteoDetails = new conteoDetailsModel(data);

    const storageConteoDetails = await newConteoDetails.save();

    if (!storageConteoDetails) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó el conteo" },
        error: false,
      });
    }

    await conteoModel.findByIdAndUpdate(
      { _id: body.conteo },
      {
        ultimoConteoDetails: storageConteoDetails._id,
        total_conteos: conteoDetailsAnterior
          ? conteoDetailsAnterior.numero_conteo + 1
          : 1,
      }
    );

    res.status(200).json({
      status: 200,
      body: storageConteoDetails,
      error: false,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};
 */
conteoCtr.postCorreccionConteoAdmin = async (req, res) => {
  const bodyData = req.body;

  const body = {
    numero_canastas: bodyData.numero_canastas,
    numero_canastillas: bodyData.numero_canastillas,
    numero_bultos: bodyData.numero_bultos,
    numero_cajas: bodyData.numero_cajas,
    carreta: bodyData.carreta,
    kg_pesados: bodyData.kg_pesados,
    unidades_contadas: bodyData.unidades_contadas,
    planilla: bodyData.planilla,
    conteo: bodyData.conteo,
    bodega: bodyData.bodega,
    mesa: bodyData.mesa,
    producto: bodyData.producto,
    colaborador: null,
  };

  try {
    const conteoDetailsAnterior = await conteoDetailsModel
      .findOne({
        planilla: body.planilla,
        conteo: body.conteo,
        estado: 0,
      })
      .sort({ _id: -1 })
      .limit(1);

    let data = {
      ...body,
      kg_neto:
        parseFloat(body.kg_pesados) -
        parseFloat(body.numero_canastas) * 2 -
        parseFloat(body.numero_canastillas) * 1.5 -
        parseFloat(body.carreta),
      numero_conteo: conteoDetailsAnterior
        ? conteoDetailsAnterior.numero_conteo + 1
        : 1,
    };

    const newConteoDetails = new conteoDetailsModel(data);

    const storageConteoDetails = await newConteoDetails.save();

    let dataComentarios = {
      planilla: bodyData.planilla,
      conteo: bodyData.conteo,
      bodega: bodyData.bodega,
      conteo: bodyData.conteo,
      conteoDetails: storageConteoDetails._id,
      descripcion: bodyData.descripcion,
    };

    const newCorrecionConteoDetails = new correcionConteoAdminModel(
      dataComentarios
    );
    const storageCorrecionConteoDetails =
      await newCorrecionConteoDetails.save();

    console.log(storageCorrecionConteoDetails);

    if (!storageConteoDetails) {
      return res.status(404).json({
        status: 404,
        body: { message: "No se guardó el conteo" },
        error: false,
      });
    }

    await conteoModel.findByIdAndUpdate(
      { _id: body.conteo },
      {
        ultimoConteoDetails: storageConteoDetails._id,
        total_conteos: conteoDetailsAnterior
          ? conteoDetailsAnterior.numero_conteo + 1
          : 1,
      }
    );

    res.status(200).json({
      status: 200,
      body: storageConteoDetails,
      error: false,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      body: { message: "Hay un error en el servidor" },
      error: true,
    });
  }
};

export default conteoCtr;
