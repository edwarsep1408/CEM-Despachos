import permisosModel from "../models/permisos.models";
import perfilesModel from "../models/perfiles.models";
import usuariosModel from "../models/usuarios.models";
import { CATALOGO_PERMISOS, todosLosCodigos } from "../seguridad/catalogoPermisos";
import { esCargoFirma, etiquetaCargo, normalizarCargo } from "../seguridad/catalogoCargos";
import { hashPassword } from "../seguridad/password";

const seguridadCtr = {};

const ok = (res, body, status = 200) =>
  res.status(status).json({ status, body, error: false });

const fail = (res, message, status = 500) =>
  res.status(status).json({ status, body: { message }, error: true });

export const asegurarCatalogoPermisos = async () => {
  for (const item of CATALOGO_PERMISOS) {
    await permisosModel.updateOne(
      { codigo: item.codigo },
      {
        $set: {
          nombre: item.nombre,
          modulo: item.modulo,
          estado: 0,
          fecha_actualizacion: new Date(),
        },
        $setOnInsert: { fecha_creacion: new Date() },
      },
      { upsert: true }
    );
  }
  let admin = await perfilesModel.findOne({ nombre: "Administrador", estado: 0 });
  if (!admin) {
    admin = await new perfilesModel({
      nombre: "Administrador",
      descripcion: "Acceso completo a la aplicaci?n",
      permisos: todosLosCodigos(),
    }).save();
  } else {
    const actuales = new Set(admin.permisos || []);
    const faltan = todosLosCodigos().filter((codigo) => !actuales.has(codigo));
    if (faltan.length) {
      admin.permisos = [...actuales, ...faltan];
      admin.fecha_actualizacion = new Date();
      await admin.save();
    }
  }
  let despachador = await perfilesModel.findOne({
    nombre: { $regex: /^despachador$/i },
    estado: 0,
  });
  const permisosPiso = ["despacho.piso"];
  if (!despachador) {
    await new perfilesModel({
      nombre: "Despachador",
      descripcion: "Usuarios de piso. Solo ven pedidos de su bodega asignada.",
      permisos: permisosPiso,
    }).save();
  } else {
    const actuales = new Set(despachador.permisos || []);
    const faltan = permisosPiso.filter((codigo) => !actuales.has(codigo));
    if (faltan.length) {
      despachador.permisos = [...actuales, ...faltan];
      despachador.fecha_actualizacion = new Date();
      await despachador.save();
    }
  }
  return admin;
};

export const esPerfilDespachador = (perfil) =>
  /despachador/i.test(String(perfil?.nombre || ""));

export const esUsuarioDespachador = (doc) =>
  String(doc?.cargo || "").toUpperCase() === "DESPACHADOR" || esPerfilDespachador(doc?.perfil);

seguridadCtr.getPermisos = async (_req, res) => {
  try {
    await asegurarCatalogoPermisos();
    const body = await permisosModel.find({ estado: 0 }).sort({ modulo: 1, nombre: 1 });
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer los permisos.");
  }
};

seguridadCtr.postPermiso = async (req, res) => {
  try {
    const { codigo, nombre, modulo } = req.body || {};
    if (!codigo || !nombre || !modulo) {
      return fail(res, "C?digo, nombre y m?dulo son obligatorios.", 400);
    }
    const existe = await permisosModel.findOne({ codigo: String(codigo).trim(), estado: 0 });
    if (existe) return fail(res, "Ese c?digo de permiso ya existe.", 400);
    const body = await new permisosModel({
      codigo: String(codigo).trim(),
      nombre: String(nombre).trim(),
      modulo: String(modulo).trim(),
    }).save();
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo guardar el permiso.");
  }
};

seguridadCtr.putPermiso = async (req, res) => {
  try {
    const { _id, codigo, nombre, modulo } = req.body || {};
    const body = await permisosModel.findByIdAndUpdate(
      _id,
      {
        codigo,
        nombre,
        modulo,
        fecha_actualizacion: new Date(),
      },
      { new: true }
    );
    if (!body) return fail(res, "No se encontr? el permiso.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo actualizar el permiso.");
  }
};

seguridadCtr.deletePermiso = async (req, res) => {
  try {
    const body = await permisosModel.findByIdAndUpdate(
      req.params._id,
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!body) return fail(res, "No se encontr? el permiso.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo eliminar el permiso.");
  }
};

seguridadCtr.getPerfiles = async (_req, res) => {
  try {
    await asegurarCatalogoPermisos();
    const body = await perfilesModel.find({ estado: 0 }).sort({ nombre: 1 });
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer los perfiles.");
  }
};

seguridadCtr.postPerfil = async (req, res) => {
  try {
    const { nombre, descripcion, permisos } = req.body || {};
    if (!nombre) return fail(res, "El nombre del perfil es obligatorio.", 400);
    const existe = await perfilesModel.findOne({
      nombre: String(nombre).trim(),
      estado: 0,
    });
    if (existe) return fail(res, "Ya existe un perfil con ese nombre.", 400);
    const body = await new perfilesModel({
      nombre: String(nombre).trim(),
      descripcion: String(descripcion || "").trim(),
      permisos: Array.isArray(permisos) ? permisos : [],
    }).save();
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo guardar el perfil.");
  }
};

seguridadCtr.putPerfil = async (req, res) => {
  try {
    const { _id, nombre, descripcion, permisos } = req.body || {};
    const body = await perfilesModel.findByIdAndUpdate(
      _id,
      {
        nombre,
        descripcion,
        permisos: Array.isArray(permisos) ? permisos : [],
        fecha_actualizacion: new Date(),
      },
      { new: true }
    );
    if (!body) return fail(res, "No se encontr? el perfil.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo actualizar el perfil.");
  }
};

seguridadCtr.deletePerfil = async (req, res) => {
  try {
    const enUso = await usuariosModel.countDocuments({
      perfil: req.params._id,
      estado: 0,
    });
    if (enUso) {
      return fail(res, "No se puede eliminar: hay usuarios con este perfil.", 400);
    }
    const body = await perfilesModel.findByIdAndUpdate(
      req.params._id,
      { estado: 2, fecha_actualizacion: new Date() },
      { new: true }
    );
    if (!body) return fail(res, "No se encontr? el perfil.", 404);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudo eliminar el perfil.");
  }
};

const usuarioPublico = (doc) => {
  if (!doc) return doc;
  const json = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete json.password;
  json.cargo = String(json.cargo || "").toUpperCase();
  if (!json.cargo && esPerfilDespachador(json.perfil)) json.cargo = "DESPACHADOR";
  else if (!json.cargo) json.cargo = String(json.cargoFirma || "").toUpperCase();
  json.puedeFirmar = esCargoFirma(json.cargo);
  json.cargoFirma = json.puedeFirmar ? json.cargo : "";
  json.cargoEtiqueta = etiquetaCargo(json.cargo);
  json.tieneFirma = Boolean(json.firma);
  json.activo = json.estado !== 2;
  delete json.firma;
  return json;
};

const aplicarCargoUsuario = (actual, body = {}) => {
  const cargo = normalizarCargo(body.cargo ?? actual.cargo);
  actual.cargo = cargo;
  actual.puedeFirmar = esCargoFirma(cargo);
  actual.cargoFirma = actual.puedeFirmar ? cargo : "";
  if (body.borrarFirma) actual.firma = "";
};

const buscarPorUsuario = (usuario, exceptoId) => {
  const clave = String(usuario || "").trim();
  if (!clave) return null;
  const filtro = {
    usuario: { $regex: `^${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  };
  if (exceptoId) filtro._id = { $ne: exceptoId };
  return usuariosModel.findOne(filtro);
};

seguridadCtr.getDespachadores = async (_req, res) => {
  try {
    await asegurarCatalogoPermisos();
    const usuarios = await usuariosModel
      .find({ estado: 0 })
      .populate("perfil", "nombre permisos")
      .sort({ nombre: 1 });
    const body = usuarios
      .filter((doc) => esUsuarioDespachador(doc))
      .map(usuarioPublico);
    return ok(res, body);
  } catch (error) {
    return fail(res, "No se pudieron leer los despachadores.");
  }
};

seguridadCtr.putAsignacionBodega = async (req, res) => {
  try {
    const { _id, bodega, bodegaNombre } = req.body || {};
    const actual = await usuariosModel.findById(_id).populate("perfil", "nombre");
    if (!actual || actual.estado === 2) {
      return fail(res, "No se encontr? el usuario.", 404);
    }
    if (!esUsuarioDespachador(actual)) {
      return fail(res, "Solo se puede asignar bodega a usuarios despachadores.", 400);
    }
    actual.bodega = String(bodega || "").trim();
    actual.bodegaNombre = String(bodegaNombre || "").trim();
    actual.muelle = 0;
    actual.fecha_actualizacion = new Date();
    await actual.save();
    const body = await usuariosModel
      .findById(_id)
      .populate("perfil", "nombre permisos");
    return ok(res, usuarioPublico(body));
  } catch (error) {
    return fail(res, "No se pudo guardar la asignaci?n de bodega.");
  }
};

seguridadCtr.getUsuarios = async (_req, res) => {
  try {
    await asegurarCatalogoPermisos();
    const body = await usuariosModel
      .find({ estado: { $in: [0, 2] } })
      .populate("perfil", "nombre permisos")
      .sort({ estado: 1, usuario: 1 });
    return ok(res, body.map(usuarioPublico));
  } catch (error) {
    return fail(res, "No se pudieron leer los usuarios.");
  }
};

seguridadCtr.postUsuario = async (req, res) => {
  try {
    const { usuario, nombre, password, perfil } = req.body || {};
    const cargo = normalizarCargo(req.body?.cargo);
    if (!usuario || !nombre || !password) {
      return fail(res, "Usuario, nombre y contraseña son obligatorios.", 400);
    }
    if (!cargo) return fail(res, "Seleccione el cargo.", 400);
    const existe = await buscarPorUsuario(usuario);
    if (existe) {
      return fail(
        res,
        existe.estado === 2
          ? "Ese usuario está inactivo. Actívelo en lugar de crear uno nuevo."
          : "Ese usuario ya existe.",
        400
      );
    }
    const soloFirma = esCargoFirma(cargo);
    let perfilId = null;
    if (!soloFirma) {
      if (!perfil) return fail(res, "Seleccione el perfil de sistema.", 400);
      const perfilDoc = await perfilesModel.findOne({ _id: perfil, estado: 0 });
      if (!perfilDoc) return fail(res, "El perfil no existe.", 400);
      perfilId = perfil;
    }
    const creado = new usuariosModel({
      usuario: String(usuario).trim(),
      nombre: String(nombre).trim(),
      password: hashPassword(password),
      perfil: perfilId,
    });
    aplicarCargoUsuario(creado, { cargo });
    await creado.save();
    const body = await usuariosModel
      .findById(creado._id)
      .populate("perfil", "nombre permisos");
    return ok(res, usuarioPublico(body));
  } catch (error) {
    return fail(res, "No se pudo guardar el usuario.");
  }
};

seguridadCtr.putUsuario = async (req, res) => {
  try {
    const { _id, usuario, nombre, password, perfil } = req.body || {};
    const actual = await usuariosModel.findById(_id);
    if (!actual || (actual.estado !== 0 && actual.estado !== 2)) {
      return fail(res, "No se encontr? el usuario.", 404);
    }
    const nuevoUsuario = String(usuario || actual.usuario).trim();
    const duplicado = await buscarPorUsuario(nuevoUsuario, _id);
    if (duplicado) return fail(res, "Ese usuario ya existe.", 400);
    const cargo = normalizarCargo(req.body?.cargo ?? actual.cargo);
    if (!cargo) return fail(res, "Seleccione el cargo.", 400);
    actual.usuario = nuevoUsuario;
    actual.nombre = String(nombre || actual.nombre).trim();
    if (esCargoFirma(cargo)) {
      actual.perfil = null;
    } else {
      const perfilId = perfil || actual.perfil;
      if (!perfilId) return fail(res, "Seleccione el perfil de sistema.", 400);
      const perfilDoc = await perfilesModel.findOne({ _id: perfilId, estado: 0 });
      if (!perfilDoc) return fail(res, "El perfil no existe.", 400);
      actual.perfil = perfilId;
    }
    if (password) actual.password = hashPassword(password);
    aplicarCargoUsuario(actual, { cargo, borrarFirma: req.body?.borrarFirma });
    actual.fecha_actualizacion = new Date();
    await actual.save();
    const body = await usuariosModel
      .findById(_id)
      .populate("perfil", "nombre permisos");
    return ok(res, usuarioPublico(body));
  } catch (error) {
    return fail(res, "No se pudo actualizar el usuario.");
  }
};

seguridadCtr.deleteUsuario = async (req, res) => {
  try {
    const actual = await usuariosModel.findById(req.params._id);
    if (!actual || (actual.estado !== 0 && actual.estado !== 2)) {
      return fail(res, "No se encontr? el usuario.", 404);
    }
    actual.estado = 2;
    actual.fecha_actualizacion = new Date();
    await actual.save();
    const body = await usuariosModel
      .findById(actual._id)
      .populate("perfil", "nombre permisos");
    return ok(res, usuarioPublico(body));
  } catch (error) {
    return fail(res, "No se pudo inactivar el usuario.");
  }
};

seguridadCtr.putUsuarioEstado = async (req, res) => {
  try {
    const { _id } = req.body || {};
    const activo = req.body?.activo !== false && req.body?.estado !== 2;
    const actual = await usuariosModel.findById(_id);
    if (!actual || (actual.estado !== 0 && actual.estado !== 2)) {
      return fail(res, "No se encontr? el usuario.", 404);
    }
    actual.estado = activo ? 0 : 2;
    actual.fecha_actualizacion = new Date();
    await actual.save();
    const body = await usuariosModel
      .findById(_id)
      .populate("perfil", "nombre permisos");
    return ok(res, usuarioPublico(body));
  } catch (error) {
    return fail(res, "No se pudo actualizar el estado del usuario.");
  }
};

export default seguridadCtr;
