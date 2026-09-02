import mongoose from "mongoose";
import basculaModel from "../models/basculas.models";
import bodegaModel from "../models/bodega.models";
import muelleModel from "../models/muelles.models";
import usuariosModel from "../models/usuarios.models";
import * as basculasTcp from "../services/basculasTcp.servicios";
import { migrarMuelles } from "../services/muelles.migrar";

const basculaCtr = {};

const IP_LOCAL =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const PUERTO_DEFAULT = 5001;

const populateBascula = (query) => query.populate("bodega").populate("muelle");

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const limpiar = (body = {}) => {
  const puerto = Number(body.puerto);
  return {
    nombre: String(body.nombre || "").trim(),
    ip: String(body.ip || "").trim(),
    puerto: Number.isInteger(puerto) ? puerto : PUERTO_DEFAULT,
    bodega: body.bodega,
    muelle: body.muelle,
  };
};

const validarCampos = async ({ nombre, ip, puerto, bodega, muelle }, { exceptoId } = {}) => {
  if (!nombre) return "El nombre es obligatorio.";
  if (!ip) return "La IP local es obligatoria.";
  if (!IP_LOCAL.test(ip)) return "La IP local no es válida. Use IPv4 (ej. 192.168.1.106).";
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    return "El puerto TCP debe estar entre 1 y 65535.";
  }
  if (!muelle || !mongoose.isValidObjectId(muelle)) return "Seleccione un muelle de despacho.";
  const muelleDoc = await muelleModel.findOne({ _id: muelle, estado: 0 }).populate("bodega").lean();
  if (!muelleDoc) return "El muelle no existe.";
  const bodegaMuelle = muelleDoc.bodega?._id || muelleDoc.bodega;
  if (bodega && String(bodega) !== String(bodegaMuelle)) {
    return "La báscula debe quedar en la misma bodega del muelle.";
  }
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicadaNombre = await basculaModel.findOne({
    nombre,
    estado: 0,
    ...filtroId,
  }).lean();
  if (duplicadaNombre) return "Ya hay una báscula con ese nombre.";
  const duplicadaIp = await basculaModel.findOne({
    ip,
    puerto,
    estado: 0,
    ...filtroId,
  }).lean();
  if (duplicadaIp) return "Ya hay una báscula con esa IP y puerto.";
  const duplicadaMuelle = await basculaModel.findOne({
    muelle,
    estado: 0,
    ...filtroId,
  }).lean();
  if (duplicadaMuelle) {
    const codigo = muelleDoc.bodega?.codigo || "";
    return `Ya hay una báscula en ${muelleDoc.nombre}${codigo ? ` de ${codigo}` : ""}.`;
  }
  return null;
};

const datosConBodegaDelMuelle = async (datos) => {
  const muelleDoc = await muelleModel.findOne({ _id: datos.muelle, estado: 0 }).lean();
  return { ...datos, bodega: muelleDoc.bodega };
};

basculaCtr.postBascula = async (req, res) => {
  try {
    await migrarMuelles();
    const datos = limpiar(req.body);
    const error = await validarCampos(datos);
    if (error) return fail(res, error, 400);
    const row = await new basculaModel(await datosConBodegaDelMuelle(datos)).save();
    const body = await populateBascula(basculaModel.findById(row._id));
    return ok(res, body);
  } catch (error) {
    console.error("postBascula:", error.message);
    return fail(res, "No se pudo guardar la báscula.", 500);
  }
};

const cuentaDeIdentity = async (identity = {}) => {
  if (identity.usuarioId && mongoose.isValidObjectId(identity.usuarioId)) {
    return usuariosModel.findById(identity.usuarioId).lean();
  }
  const usuario = String(identity.usuario || "").trim();
  if (!usuario || identity.perfil === "Administrador") return null;
  return usuariosModel.findOne({ usuario, estado: 0 }).lean();
};

basculaCtr.getBasculaPiso = async (req, res) => {
  try {
    await migrarMuelles();
    const identity = req.user?.identity || {};
    const cuenta = await cuentaDeIdentity(identity);
    const muelleId = String(req.query?.muelle || "").trim();

    if (cuenta) {
      const codigoBodega = String(cuenta.bodega || "").trim();
      if (!codigoBodega) {
        return fail(res, "Asigne una bodega a este despachador en Asignación de bodega.", 400);
      }
      const bodega = await bodegaModel.findOne({ codigo: codigoBodega, estado: 0 }).lean();
      if (!bodega) return fail(res, `No se encontró la bodega ${codigoBodega}.`, 404);
      const muelles = await muelleModel.find({ bodega: bodega._id, estado: 0 }).sort({ nombre: 1 }).lean();
      if (!muelles.length) {
        return fail(res, `No hay muelles configurados para ${codigoBodega}. Créelos en Configuración → Muelles.`, 404);
      }
      let muelle = muelleId && muelles.find((item) => String(item._id) === muelleId);
      if (!muelle && muelles.length === 1) muelle = muelles[0];
      if (!muelle) {
        return fail(res, "Seleccione el muelle de este PC.", 400);
      }
      const body = await populateBascula(
        basculaModel.findOne({ muelle: muelle._id, estado: 0 })
      ).lean();
      if (!body) {
        return fail(res, `No hay báscula configurada para ${muelle.nombre} de ${codigoBodega}.`, 404);
      }
      return ok(res, { ...body, bodegaCodigo: codigoBodega });
    }

    if (muelleId && mongoose.isValidObjectId(muelleId)) {
      const body = await populateBascula(
        basculaModel.findOne({ muelle: muelleId, estado: 0 })
      ).lean();
      if (!body) return fail(res, "No hay báscula configurada para ese muelle.", 404);
      return ok(res, body);
    }

    const body = await populateBascula(basculaModel.findOne({ estado: 0 }).sort({ nombre: 1 })).lean();
    if (!body) return fail(res, "No hay una báscula configurada.", 404);
    return ok(res, body);
  } catch (error) {
    console.error("getBasculaPiso:", error.message);
    return fail(res, "No se pudo leer la báscula.", 500);
  }
};

basculaCtr.getBasculas = async (_req, res) => {
  try {
    await migrarMuelles();
    const body = await populateBascula(basculaModel.find({ estado: 0 }).sort({ nombre: 1 })).lean();
    return ok(res, body);
  } catch (error) {
    console.error("getBasculas:", error.message);
    return fail(res, "No se pudieron leer las básculas.", 500);
  }
};

basculaCtr.getBasculasBodega = async (req, res) => {
  try {
    await migrarMuelles();
    const { bodega } = req.params;
    if (!mongoose.isValidObjectId(bodega)) return fail(res, "Bodega inválida.", 400);
    const body = await populateBascula(
      basculaModel.find({ bodega, estado: 0 }).sort({ nombre: 1 })
    ).lean();
    return ok(res, body);
  } catch (error) {
    console.error("getBasculasBodega:", error.message);
    return fail(res, "No se pudieron leer las básculas de la bodega.", 500);
  }
};

basculaCtr.updateBascula = async (req, res) => {
  try {
    await migrarMuelles();
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Báscula inválida.", 400);
    const datos = limpiar(req.body);
    const error = await validarCampos(datos, { exceptoId: _id });
    if (error) return fail(res, error, 400);
    const row = await populateBascula(
      basculaModel.findOneAndUpdate(
        { _id, estado: 0 },
        { ...(await datosConBodegaDelMuelle(datos)), fecha_actualizacion: new Date() },
        { new: true }
      )
    );
    if (!row) return fail(res, "No se encontró la báscula.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("updateBascula:", error.message);
    return fail(res, "No se pudo actualizar la báscula.", 500);
  }
};

basculaCtr.deleteBascula = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Báscula inválida.", 400);
    const row = await basculaModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró la báscula.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("deleteBascula:", error.message);
    return fail(res, "No se pudo eliminar la báscula.", 500);
  }
};

basculaCtr.escucharBascula = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Báscula inválida.", 400);
    const row = await basculaModel.findOne({ _id, estado: 0 }).lean();
    if (!row) return fail(res, "No se encontró la báscula.", 404);
    const body = await basculasTcp.escuchar({
      id: String(row._id),
      ip: row.ip,
      puerto: row.puerto,
    });
    return ok(res, {
      message: `Escuchando ${row.ip}:${row.puerto}`,
      ...body,
    });
  } catch (error) {
    console.error("escucharBascula:", error.message);
    return fail(res, error.message || "No se pudo abrir la escucha.", 502);
  }
};

basculaCtr.detenerBascula = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Báscula inválida.", 400);
    basculasTcp.detener(_id);
    return ok(res, { message: "Escucha detenida." });
  } catch (error) {
    console.error("detenerBascula:", error.message);
    return fail(res, "No se pudo detener la escucha.", 500);
  }
};

basculaCtr.enviarBascula = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Báscula inválida.", 400);
    const texto = req.body?.texto ?? "";
    const crlf = req.body?.crlf || "none";
    const bytes = basculasTcp.enviar(_id, texto, { crlf });
    return ok(res, { message: "Enviado.", bytes });
  } catch (error) {
    console.error("enviarBascula:", error.message);
    return fail(res, error.message || "No se pudo enviar el comando.", 400);
  }
};

export default basculaCtr;
