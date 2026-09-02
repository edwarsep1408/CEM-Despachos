import mongoose from "mongoose";
import firmanteModel from "../models/firmantes.models";
import usuariosModel from "../models/usuarios.models";
import { esCargoFirma } from "../seguridad/catalogoCargos";

const firmanteCtr = {};

export const CARGOS_FIRMA = {
  AUXILIAR_CALIDAD: "AUXILIAR DE CALIDAD",
  SUPERVISOR_LOGISTICA: "SUPERVISOR DE LOGISTICA",
};

const CARGOS = Object.keys(CARGOS_FIRMA);
const MAX_FIRMA = 400000;

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 400) =>
  res.status(status).json({ status, body: { message }, error: status >= 500 });

const etiquetaDe = (cargo) => CARGOS_FIRMA[cargo] || cargo;

const cargoDeUsuario = (usuario) => {
  const cargo = String(usuario?.cargo || "").trim().toUpperCase();
  if (esCargoFirma(cargo)) return cargo;
  if (cargo) return "";
  const legado = String(usuario?.cargoFirma || "").trim().toUpperCase();
  return esCargoFirma(legado) ? legado : "";
};

export const snapshotFirmante = (row) => {
  if (!row) return null;
  return {
    firmanteId: String(row._id),
    nombre: row.nombre || "",
    cargo: row.cargo || "",
    cargoEtiqueta: etiquetaDe(row.cargo),
    firma: row.firma || "",
  };
};

export const cargarSnapshotFirmante = async (id, cargoEsperado) => {
  const clave = String(id || "").trim();
  if (!clave) return null;
  if (!mongoose.isValidObjectId(clave)) {
    const error = new Error("Firmante inválido.");
    error.status = 400;
    throw error;
  }
  const catalogo = await firmanteModel.findOne({ _id: clave, estado: 0 }).lean();
  const usuario = catalogo
    ? null
    : await usuariosModel.findOne({ _id: clave, estado: 0, puedeFirmar: true }).lean();
  const row = catalogo
    ? catalogo
    : usuario
      ? {
          _id: usuario._id,
          nombre: usuario.nombre,
          cargo: cargoDeUsuario(usuario),
          firma: usuario.firma,
        }
      : null;
  if (!row) {
    const error = new Error("No se encontró el firmante.");
    error.status = 404;
    throw error;
  }
  if (cargoEsperado && row.cargo !== cargoEsperado) {
    const error = new Error(`Ese firmante no es ${etiquetaDe(cargoEsperado)}.`);
    error.status = 400;
    throw error;
  }
  if (!row.firma) {
    const error = new Error(`Guarde la firma de ${row.nombre} antes de usarla en una hoja.`);
    error.status = 400;
    throw error;
  }
  return snapshotFirmante(row);
};

export const firmaDe = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(texto)) return null;
  if (texto.length > MAX_FIRMA) return null;
  return texto;
};

const limpiar = (body = {}) => {
  const cargo = String(body.cargo || "").trim().toUpperCase();
  return {
    nombre: String(body.nombre || "").trim().toUpperCase(),
    cargo: CARGOS.includes(cargo) ? cargo : "",
    firma: firmaDe(body.firma),
  };
};

const validarCampos = async (datos, { exceptoId, exigirFirma } = {}) => {
  if (!datos.nombre) return "El nombre es obligatorio.";
  if (!datos.cargo) return "Seleccione el cargo: auxiliar de calidad o supervisor de logística.";
  if (datos.firma === null) return "La firma debe ser una imagen PNG o JPG (máx. 300 KB).";
  if (exigirFirma && !datos.firma) return "Dibuje o cargue la firma.";
  const filtroId = exceptoId ? { _id: { $ne: exceptoId } } : {};
  const duplicado = await firmanteModel
    .findOne({ nombre: datos.nombre, cargo: datos.cargo, estado: 0, ...filtroId })
    .lean();
  if (duplicado) return "Ya hay un firmante con ese nombre y cargo.";
  return null;
};

const siguienteId = async () => {
  const ultimo = await firmanteModel.findOne().sort({ idFirmante: -1 }).lean();
  return (ultimo?.idFirmante || 0) + 1;
};

const publico = (row) => ({
  ...row,
  cargoEtiqueta: etiquetaDe(row.cargo),
  tieneFirma: Boolean(row.firma),
});

firmanteCtr.getCargos = async (_req, res) =>
  ok(
    res,
    CARGOS.map((codigo) => ({ codigo, etiqueta: CARGOS_FIRMA[codigo] }))
  );

firmanteCtr.getFirmantes = async (req, res) => {
  try {
    const cargo = String(req.query.cargo || "").trim().toUpperCase();
    const filtro = { estado: 0 };
    if (cargo && CARGOS.includes(cargo)) filtro.cargo = cargo;
    const catalogo = await firmanteModel.find(filtro).sort({ cargo: 1, nombre: 1 }).lean();
    const usuarios = await usuariosModel
      .find({
        estado: 0,
        $or: [{ puedeFirmar: true }, { cargo: { $in: CARGOS } }],
      })
      .sort({ nombre: 1 })
      .lean();
    const deUsuarios = usuarios
      .map((item) => {
        const cargoUsuario = cargoDeUsuario(item);
        return cargoUsuario
          ? publico({
              _id: item._id,
              idFirmante: null,
              nombre: item.nombre,
              cargo: cargoUsuario,
              firma: item.firma || "",
              origen: "usuario",
            })
          : null;
      })
      .filter((item) => item && (!cargo || item.cargo === cargo));
    const deCatalogo = catalogo.map((item) => publico({ ...item, origen: "catalogo" }));
    const body = [...deUsuarios, ...deCatalogo].sort((a, b) => {
      const cargoCmp = String(a.cargo || "").localeCompare(String(b.cargo || ""));
      if (cargoCmp) return cargoCmp;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
    return ok(res, body);
  } catch (error) {
    console.error("getFirmantes:", error.message);
    return fail(res, "No se pudieron leer los firmantes.", 500);
  }
};

const cuentaFirmanteDe = async (req) => {
  const identity = req.user?.identity || {};
  if (identity.usuarioId && mongoose.isValidObjectId(identity.usuarioId)) {
    const porId = await usuariosModel.findOne({ _id: identity.usuarioId, estado: 0 });
    if (porId) return porId;
  }
  const usuario = String(identity.usuario || "").trim();
  if (!usuario) return null;
  return usuariosModel.findOne({
    usuario: { $regex: `^${usuario.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    estado: 0,
  });
};

firmanteCtr.getMiFirma = async (req, res) => {
  try {
    const cuenta = await cuentaFirmanteDe(req);
    if (!cuenta) return fail(res, "Inicie sesión con su usuario de planta para firmar.", 403);
    if (!cuenta.puedeFirmar && !esCargoFirma(cuenta.cargo)) {
      return fail(res, "Este usuario no está habilitado para firmar. Pida el permiso en Usuarios.", 403);
    }
    const cargo = cargoDeUsuario(cuenta);
    return ok(res, {
      nombre: cuenta.nombre,
      usuario: cuenta.usuario,
      cargo,
      cargoEtiqueta: etiquetaDe(cargo),
      firma: cuenta.firma || "",
      tieneFirma: Boolean(cuenta.firma),
    });
  } catch (error) {
    console.error("getMiFirma:", error.message);
    return fail(res, "No se pudo leer la firma.", 500);
  }
};

firmanteCtr.putMiFirma = async (req, res) => {
  try {
    const cuenta = await cuentaFirmanteDe(req);
    if (!cuenta) return fail(res, "Inicie sesión con su usuario de planta para firmar.", 403);
    if (!cuenta.puedeFirmar && !esCargoFirma(cuenta.cargo)) {
      return fail(res, "Este usuario no está habilitado para firmar. Pida el permiso en Usuarios.", 403);
    }
    const firma = firmaDe(req.body?.firma);
    if (firma === null) return fail(res, "La firma debe ser una imagen PNG o JPG (máx. 300 KB).", 400);
    if (!firma) return fail(res, "Dibuje la firma en la pantalla.", 400);
    cuenta.firma = firma;
    cuenta.fecha_actualizacion = new Date();
    await cuenta.save();
    const cargo = cargoDeUsuario(cuenta);
    return ok(res, {
      nombre: cuenta.nombre,
      usuario: cuenta.usuario,
      cargo,
      cargoEtiqueta: etiquetaDe(cargo),
      firma: cuenta.firma,
      tieneFirma: true,
    });
  } catch (error) {
    console.error("putMiFirma:", error.message);
    return fail(res, "No se pudo guardar la firma.", 500);
  }
};

firmanteCtr.postFirmante = async (req, res) => {
  try {
    const datos = limpiar(req.body);
    const error = await validarCampos(datos, { exigirFirma: true });
    if (error) return fail(res, error, 400);
    const body = await new firmanteModel({
      ...datos,
      idFirmante: await siguienteId(),
    }).save();
    return ok(res, publico(body.toObject()), 201);
  } catch (error) {
    console.error("postFirmante:", error.message);
    return fail(res, "No se pudo guardar el firmante.", 500);
  }
};

firmanteCtr.updateFirmante = async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Firmante inválido.");
    const actual = await firmanteModel.findOne({ _id, estado: 0 }).lean();
    if (!actual) return fail(res, "No se encontró el firmante.", 404);
    const datos = limpiar(req.body);
    if (!datos.firma) datos.firma = actual.firma || "";
    const error = await validarCampos(datos, { exceptoId: _id, exigirFirma: true });
    if (error) return fail(res, error, 400);
    const row = await firmanteModel.findOneAndUpdate(
      { _id, estado: 0 },
      { ...datos, fecha_actualizacion: new Date() },
      { new: true }
    );
    return ok(res, publico(row.toObject()));
  } catch (error) {
    console.error("updateFirmante:", error.message);
    return fail(res, "No se pudo actualizar el firmante.", 500);
  }
};

firmanteCtr.deleteFirmante = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id || !mongoose.isValidObjectId(_id)) return fail(res, "Firmante inválido.");
    const row = await firmanteModel.findOneAndUpdate(
      { _id, estado: 0 },
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!row) return fail(res, "No se encontró el firmante.", 404);
    return ok(res, publico(row.toObject()));
  } catch (error) {
    console.error("deleteFirmante:", error.message);
    return fail(res, "No se pudo eliminar el firmante.", 500);
  }
};

export default firmanteCtr;
