import mongoose from "mongoose";
import vehiculoModel from "../models/vehiculos.models";
import { cargarCatalogoVehiculos, normalizarPlaca, toneladasDeCapacidad } from "../data/vehiculos.catalogo";
import { hashPassword } from "../seguridad/password";

const vehiculoCtr = {};

const EXTRAS_WCP272 = {
  celularPtoContacto: "3173639164",
  transportadora: "LIFTIT CARCO SAS",
};

let catalogoSincronizado = false;

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const presentarVehiculo = (doc) => {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...(doc || {}) };
  const tienePassword = Boolean(row.passwordHash);
  delete row.passwordHash;
  return { ...row, capacidad: toneladasDeCapacidad(row.capacidad), tienePassword };
};

const passwordDeBody = (body = {}) => {
  const plain = String(body.password || body.clave || "").trim();
  if (!plain) return { ok: true, hash: null };
  if (plain.length < 4) return { ok: false, error: "La contraseña del portal debe tener al menos 4 caracteres." };
  return { ok: true, hash: hashPassword(plain) };
};

const siguienteIdVehiculo = async () => {
  const ultimo = await vehiculoModel.findOne().sort({ idVehiculo: -1 }).lean();
  return (ultimo?.idVehiculo || 0) + 1;
};

const limpiar = (body = {}) => {
  const flete = Number(body.flete);
  return {
    placa: normalizarPlaca(body.placa),
    conductor: String(body.conductor || "").trim(),
    telefono: String(body.telefono || "").trim(),
    capacidad: toneladasDeCapacidad(body.capacidad),
    flete: Number.isFinite(flete) ? flete : 0,
    idConductor: String(body.idConductor || "").trim(),
    celularPtoContacto: String(body.celularPtoContacto || "").trim(),
    transportadora: String(body.transportadora || "").trim(),
  };
};

const validarCampos = async (datos, { exceptoId } = {}) => {
  if (!datos.placa) return "La placa es obligatoria.";
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicada = await vehiculoModel.findOne({ placa: datos.placa, estado: 0, ...filtroId }).lean();
  if (duplicada) return "Ya hay un vehículo con esa placa.";
  return null;
};

export const sembrarVehiculos = async () => {
  if (catalogoSincronizado) return;
  const catalogo = cargarCatalogoVehiculos();
  if (!catalogo.length) {
    catalogoSincronizado = true;
    return;
  }

  const actuales = await vehiculoModel.find({ estado: { $in: [0, 2] } }).lean();
  const porPlaca = new Map();
  for (const row of actuales) {
    const clave = normalizarPlaca(row.placa);
    if (!clave) continue;
    const prev = porPlaca.get(clave);
    if (!prev || (prev.estado !== 0 && row.estado === 0)) porPlaca.set(clave, row);
  }

  const ops = [];
  const vistos = new Set();
  for (const row of catalogo) {
    const clave = normalizarPlaca(row.placa);
    vistos.add(clave);
    const datos = {
      idVehiculo: row.idVehiculo,
      placa: row.placa,
      conductor: row.conductor,
      telefono: row.telefono,
      capacidad: row.capacidad,
      flete: row.flete,
      idConductor: row.idConductor,
      estado: 0,
      fecha_actualizacion: new Date(),
    };
    const actual = porPlaca.get(clave);
    if (actual) {
      ops.push({
        updateOne: {
          filter: { _id: actual._id },
          update: { $set: datos },
        },
      });
    } else {
      ops.push({
        updateOne: {
          filter: { placa: row.placa, estado: 0 },
          update: {
            $set: datos,
            $setOnInsert: {
              fecha_creacion: new Date(),
              celularPtoContacto: "",
              transportadora: "",
            },
          },
          upsert: true,
        },
      });
    }
  }

  for (const [clave, actual] of porPlaca.entries()) {
    if (vistos.has(clave)) continue;
    ops.push({
      updateOne: {
        filter: { _id: actual._id },
        update: { $set: { estado: 2, fecha_actualizacion: new Date() } },
      },
    });
  }

  if (ops.length) {
    const lote = 500;
    for (let i = 0; i < ops.length; i += lote) {
      await vehiculoModel.bulkWrite(ops.slice(i, i + lote), { ordered: false });
    }
  }

  await vehiculoModel.updateOne({ placa: "WCP272", estado: 0 }, { $set: EXTRAS_WCP272 });

  catalogoSincronizado = true;
};

vehiculoCtr.getVehiculos = async (_req, res) => {
  try {
    await sembrarVehiculos();
    const docs = await vehiculoModel
      .find({ estado: 0 })
      .select("+passwordHash")
      .sort({ idVehiculo: 1, placa: 1 })
      .lean();
    return ok(res, docs.map(presentarVehiculo));
  } catch (error) {
    console.error("getVehiculos:", error.message);
    return fail(res, "No se pudieron leer los vehículos.", 500);
  }
};

vehiculoCtr.postVehiculo = async (req, res) => {
  try {
    const datos = limpiar(req.body);
    const error = await validarCampos(datos);
    if (error) return fail(res, error, 400);
    const clave = passwordDeBody(req.body);
    if (!clave.ok) return fail(res, clave.error, 400);
    const body = await new vehiculoModel({
      ...datos,
      ...(clave.hash ? { passwordHash: clave.hash } : {}),
      idVehiculo: await siguienteIdVehiculo(),
    }).save();
    return ok(res, presentarVehiculo(body));
  } catch (error) {
    console.error("postVehiculo:", error.message);
    return fail(res, "No se pudo guardar el vehículo.", 500);
  }
};

vehiculoCtr.updateVehiculo = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Vehículo inválido.");
    const datos = limpiar(req.body);
    const error = await validarCampos(datos, { exceptoId: _id });
    if (error) return fail(res, error, 400);
    const clave = passwordDeBody(req.body);
    if (!clave.ok) return fail(res, clave.error, 400);
    const set = { ...datos, fecha_actualizacion: new Date() };
    if (clave.hash) set.passwordHash = clave.hash;
    const body = await vehiculoModel.findOneAndUpdate(
      { _id, estado: 0 },
      { $set: set },
      { new: true }
    );
    if (!body) return fail(res, "No se encontró el vehículo.", 404);
    return ok(res, presentarVehiculo(body));
  } catch (error) {
    console.error("updateVehiculo:", error.message);
    return fail(res, "No se pudo actualizar el vehículo.", 500);
  }
};

vehiculoCtr.deleteVehiculo = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Vehículo inválido.");
    const body = await vehiculoModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!body) return fail(res, "No se encontró el vehículo.", 404);
    return ok(res, body);
  } catch (error) {
    console.error("deleteVehiculo:", error.message);
    return fail(res, "No se pudo eliminar el vehículo.", 500);
  }
};

export default vehiculoCtr;
