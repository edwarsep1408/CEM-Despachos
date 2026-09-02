import mongoose from "mongoose";
import taraModel from "../models/tarasEmpaques.models";

const taraCtr = {};

const UNIDADES = ["UNIDAD", "KILOS"];
const EMPAQUES = ["N/A", "CANASTA", "CAJA REFRIGERADA", "CAJA CONGELADA", "CANASTA IFCO"];

const TARAS_INICIALES = [
  { idTara: 1, nombre: "CAJA AZUL", unidad: "UNIDAD", peso: 0.7, empaque: "CAJA CONGELADA", esCaja: true },
  { idTara: 2, nombre: "CANASTA", unidad: "UNIDAD", peso: 2, empaque: "CANASTA", esCaja: false },
  { idTara: 3, nombre: "CANASTILLA", unidad: "UNIDAD", peso: 1.5, empaque: "CANASTA", esCaja: false },
  { idTara: 4, nombre: "BASE", unidad: "UNIDAD", peso: 1.8, empaque: "N/A", esCaja: false },
  { idTara: 5, nombre: "CARRETA", unidad: "KILOS", peso: 10, empaque: "N/A", esCaja: false },
  { idTara: 6, nombre: "CAJA ROJA", unidad: "UNIDAD", peso: 0.8, empaque: "CAJA REFRIGERADA", esCaja: true },
  { idTara: 7, nombre: "CANASTA IFCO", unidad: "UNIDAD", peso: 2.3, empaque: "CANASTA IFCO", esCaja: false },
];

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const esSi = (valor) => {
  if (valor === true || valor === 1) return true;
  const texto = String(valor || "").trim().toUpperCase();
  return texto === "SI" || texto === "SÍ" || texto === "TRUE";
};

const limpiar = (body = {}) => {
  const peso = Number(body.peso ?? body.pesoKg);
  const unidad = String(body.unidad || "UNIDAD").trim().toUpperCase();
  const empaque = String(body.empaque || "N/A").trim().toUpperCase() || "N/A";
  return {
    nombre: String(body.nombre || "").trim(),
    unidad: UNIDADES.includes(unidad) ? unidad : "",
    peso: Number.isFinite(peso) ? peso : NaN,
    empaque: EMPAQUES.includes(empaque) ? empaque : empaque,
    esCaja: esSi(body.esCaja),
    activo: body.activo === false || String(body.activo).toUpperCase() === "NO" ? false : true,
  };
};

const validarCampos = async ({ nombre, unidad, peso }, { exceptoId } = {}) => {
  if (!nombre) return "El nombre es obligatorio.";
  if (!UNIDADES.includes(unidad)) return "Seleccione la unidad (UNIDAD o KILOS).";
  if (!Number.isFinite(peso) || peso < 0) return "El peso de la tara no es válido.";
  if (peso > 1000) return "El peso de la tara no puede superar 1000.";
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicado = await taraModel.findOne({ nombre, estado: 0, ...filtroId }).lean();
  if (duplicado) return "Ya hay una tara con ese nombre.";
  return null;
};

const siguienteIdTara = async () => {
  const ultimo = await taraModel.findOne().sort({ idTara: -1 }).lean();
  return (ultimo?.idTara || 0) + 1;
};

const sembrarSiVacio = async () => {
  const hay = await taraModel.countDocuments({ estado: 0 });
  if (hay > 0) return;
  await taraModel.insertMany(
    TARAS_INICIALES.map((item) => ({
      ...item,
      activo: true,
      estado: 0,
    }))
  );
};

taraCtr.postTara = async (req, res) => {
  try {
    const datos = limpiar(req.body);
    const error = await validarCampos(datos);
    if (error) return fail(res, error, 400);
    const body = await new taraModel({
      ...datos,
      idTara: await siguienteIdTara(),
    }).save();
    return ok(res, body);
  } catch (error) {
    console.error("postTara:", error.message);
    return fail(res, "No se pudo guardar la tara.", 500);
  }
};

taraCtr.getTaras = async (_req, res) => {
  try {
    await sembrarSiVacio();
    const body = await taraModel.find({ estado: 0 }).sort({ idTara: 1 }).lean();
    return ok(res, body);
  } catch (error) {
    console.error("getTaras:", error.message);
    return fail(res, "No se pudieron leer las taras.", 500);
  }
};

taraCtr.updateTara = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Tara inválida.", 400);
    const datos = limpiar(req.body);
    const error = await validarCampos(datos, { exceptoId: _id });
    if (error) return fail(res, error, 400);
    const row = await taraModel.findOneAndUpdate(
      { _id, estado: 0 },
      { ...datos, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró la tara.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("updateTara:", error.message);
    return fail(res, "No se pudo actualizar la tara.", 500);
  }
};

taraCtr.deleteTara = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Tara inválida.", 400);
    const row = await taraModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, activo: false, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró la tara.", 404);
    return ok(res, row);
  } catch (error) {
    console.error("deleteTara:", error.message);
    return fail(res, "No se pudo eliminar la tara.", 500);
  }
};

export default taraCtr;
