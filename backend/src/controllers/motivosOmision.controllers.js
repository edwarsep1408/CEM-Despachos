import mongoose from "mongoose";
import motivoModel from "../models/motivosOmision.models";

const motivoCtr = {};

const MOTIVOS_INICIALES = [
  { idMotivo: 1, nombre: "CANCELADO" },
  { idMotivo: 2, nombre: "REPETIDO" },
  { idMotivo: 3, nombre: "DISPONIBILIDAD" },
  { idMotivo: 4, nombre: "EXCEDE" },
  { idMotivo: 5, nombre: "RETENIDO" },
];

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const limpiar = (body = {}) => ({
  nombre: String(body.nombre || "").trim().toUpperCase(),
});

const validarCampos = async ({ nombre }, { exceptoId } = {}) => {
  if (!nombre) return "El nombre es obligatorio.";
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicado = await motivoModel.findOne({ nombre, estado: 0, ...filtroId }).lean();
  if (duplicado) return "Ya hay un motivo con ese nombre.";
  return null;
};

const siguienteIdMotivo = async () => {
  const ultimo = await motivoModel.findOne().sort({ idMotivo: -1 }).lean();
  return (ultimo?.idMotivo || 0) + 1;
};

const sembrarSiVacio = async () => {
  const hay = await motivoModel.countDocuments({ estado: 0 });
  if (hay > 0) return;
  await motivoModel.insertMany(MOTIVOS_INICIALES.map((item) => ({ ...item, estado: 0 })));
};

motivoCtr.postMotivo = async (req, res) => {
  try {
    const datos = limpiar(req.body);
    const error = await validarCampos(datos);
    if (error) return fail(res, error, 400);
    const body = await new motivoModel({
      ...datos,
      idMotivo: await siguienteIdMotivo(),
    }).save();
    return ok(res, body);
  } catch (error) {
    console.error("postMotivo:", error.message);
    return fail(res, "No se pudo guardar el motivo.", 500);
  }
};

motivoCtr.getMotivos = async (_req, res) => {
  try {
    await sembrarSiVacio();
    const body = await motivoModel.find({ estado: 0 }).sort({ idMotivo: 1 }).lean();
    return ok(res, body);
  } catch (error) {
    console.error("getMotivos:", error.message);
    return fail(res, "No se pudieron leer los motivos.", 500);
  }
};

motivoCtr.updateMotivo = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Motivo inválido.", 400);
    const datos = limpiar(req.body);
    const error = await validarCampos(datos, { exceptoId: _id });
    if (error) return fail(res, error, 400);
    const row = await motivoModel.findOneAndUpdate(
      { _id, estado: 0 },
      { ...datos, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró el motivo.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("updateMotivo:", error.message);
    return fail(res, "No se pudo actualizar el motivo.", 500);
  }
};

motivoCtr.deleteMotivo = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Motivo inválido.", 400);
    const row = await motivoModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró el motivo.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("deleteMotivo:", error.message);
    return fail(res, "No se pudo eliminar el motivo.", 500);
  }
};

export default motivoCtr;
