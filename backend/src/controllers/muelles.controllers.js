import mongoose from "mongoose";
import muelleModel from "../models/muelles.models";
import bodegaModel from "../models/bodega.models";
import basculaModel from "../models/basculas.models";
import usuariosModel from "../models/usuarios.models";
import { migrarMuelles } from "../services/muelles.migrar";

const muelleCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const limpiar = (body = {}) => ({
  nombre: String(body.nombre || "").trim(),
  bodega: body.bodega,
});

const validar = async ({ nombre, bodega }, { exceptoId } = {}) => {
  if (!nombre) return "El nombre es obligatorio.";
  if (!bodega || !mongoose.isValidObjectId(bodega)) return "Seleccione una bodega.";
  const bodegaExiste = await bodegaModel.findOne({ _id: bodega, estado: 0 }).lean();
  if (!bodegaExiste) return "La bodega no existe.";
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicado = await muelleModel
    .findOne({ nombre, bodega, estado: 0, ...filtroId })
    .lean();
  if (duplicado) return `Ya hay un muelle "${nombre}" en ${bodegaExiste.codigo}.`;
  return null;
};

const cuentaDeIdentity = async (identity = {}) => {
  if (identity.usuarioId && mongoose.isValidObjectId(identity.usuarioId)) {
    return usuariosModel.findById(identity.usuarioId).lean();
  }
  const usuario = String(identity.usuario || "").trim();
  if (!usuario || identity.perfil === "Administrador") return null;
  return usuariosModel.findOne({ usuario, estado: 0 }).lean();
};

muelleCtr.postMuelle = async (req, res) => {
  try {
    await migrarMuelles();
    const datos = limpiar(req.body);
    const error = await validar(datos);
    if (error) return fail(res, error, 400);
    const row = await new muelleModel(datos).save();
    const body = await muelleModel.findById(row._id).populate("bodega");
    return ok(res, body);
  } catch (error) {
    console.error("postMuelle:", error.message);
    return fail(res, "No se pudo guardar el muelle.", 500);
  }
};

muelleCtr.getMuelles = async (_req, res) => {
  try {
    await migrarMuelles();
    const body = await muelleModel
      .find({ estado: 0 })
      .populate("bodega")
      .sort({ nombre: 1 })
      .lean();
    return ok(res, body);
  } catch (error) {
    console.error("getMuelles:", error.message);
    return fail(res, "No se pudieron leer los muelles.", 500);
  }
};

muelleCtr.getMuellesBodega = async (req, res) => {
  try {
    await migrarMuelles();
    const { bodega } = req.params;
    if (!mongoose.isValidObjectId(bodega)) return fail(res, "Bodega inválida.", 400);
    const body = await muelleModel
      .find({ bodega, estado: 0 })
      .populate("bodega")
      .sort({ nombre: 1 })
      .lean();
    return ok(res, body);
  } catch (error) {
    console.error("getMuellesBodega:", error.message);
    return fail(res, "No se pudieron leer los muelles de la bodega.", 500);
  }
};

muelleCtr.getMuellesPiso = async (req, res) => {
  try {
    await migrarMuelles();
    const identity = req.user?.identity || {};
    const cuenta = await cuentaDeIdentity(identity);
    const filtro = { estado: 0 };
    if (cuenta) {
      const codigoBodega = String(cuenta.bodega || "").trim();
      if (!codigoBodega) {
        return fail(res, "Asigne una bodega a este despachador en Asignación de bodega.", 400);
      }
      const bodega = await bodegaModel.findOne({ codigo: codigoBodega, estado: 0 }).lean();
      if (!bodega) return fail(res, `No se encontró la bodega ${codigoBodega}.`, 404);
      filtro.bodega = bodega._id;
    }
    const body = await muelleModel.find(filtro).populate("bodega").sort({ nombre: 1 }).lean();
    return ok(res, body);
  } catch (error) {
    console.error("getMuellesPiso:", error.message);
    return fail(res, "No se pudieron leer los muelles.", 500);
  }
};

muelleCtr.updateMuelle = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Muelle inválido.", 400);
    const datos = limpiar(req.body);
    const error = await validar(datos, { exceptoId: _id });
    if (error) return fail(res, error, 400);
    const row = await muelleModel
      .findOneAndUpdate(
        { _id, estado: 0 },
        { ...datos, fecha_actualizacion: new Date() },
        { new: true }
      )
      .populate("bodega");
    if (!row) return fail(res, "No se encontró el muelle.", 404);
    await basculaModel.updateMany({ muelle: _id, estado: 0 }, { bodega: datos.bodega });
    return ok(res, row);
  } catch (error) {
    console.error("updateMuelle:", error.message);
    return fail(res, "No se pudo actualizar el muelle.", 500);
  }
};

muelleCtr.deleteMuelle = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Muelle inválido.", 400);
    const enUso = await basculaModel.exists({ muelle: _id, estado: 0 });
    if (enUso) return fail(res, "No se puede eliminar: hay una báscula en este muelle.", 400);
    const row = await muelleModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró el muelle.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("deleteMuelle:", error.message);
    return fail(res, "No se pudo eliminar el muelle.", 500);
  }
};

export default muelleCtr;
