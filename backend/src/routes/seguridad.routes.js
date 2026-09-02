import express from "express";
import seguridadCtr from "../controllers/seguridad.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();

router.get("/get-permisos", [auth.ensureAuth, auth.requireAnyPermiso("seguridad.permisos", "seguridad.perfiles")], seguridadCtr.getPermisos);
router.post("/post-permiso", [auth.ensureAuth, auth.requirePermiso("seguridad.permisos")], seguridadCtr.postPermiso);
router.put("/put-permiso", [auth.ensureAuth, auth.requirePermiso("seguridad.permisos")], seguridadCtr.putPermiso);
router.delete("/delete-permiso/:_id", [auth.ensureAuth, auth.requirePermiso("seguridad.permisos")], seguridadCtr.deletePermiso);

router.get("/get-perfiles", [auth.ensureAuth, auth.requireAnyPermiso("seguridad.perfiles", "seguridad.usuarios")], seguridadCtr.getPerfiles);
router.post("/post-perfil", [auth.ensureAuth, auth.requirePermiso("seguridad.perfiles")], seguridadCtr.postPerfil);
router.put("/put-perfil", [auth.ensureAuth, auth.requirePermiso("seguridad.perfiles")], seguridadCtr.putPerfil);
router.delete("/delete-perfil/:_id", [auth.ensureAuth, auth.requirePermiso("seguridad.perfiles")], seguridadCtr.deletePerfil);

router.get("/get-usuarios", [auth.ensureAuth, auth.requirePermiso("seguridad.usuarios")], seguridadCtr.getUsuarios);
router.get(
  "/get-despachadores",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.cargues", "despacho.asignacion-bodega", "seguridad.usuarios")],
  seguridadCtr.getDespachadores
);
router.put(
  "/put-asignacion-bodega",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.asignacion-bodega", "despacho.cargues", "seguridad.usuarios")],
  seguridadCtr.putAsignacionBodega
);
router.post("/post-usuario", [auth.ensureAuth, auth.requirePermiso("seguridad.usuarios")], seguridadCtr.postUsuario);
router.put("/put-usuario", [auth.ensureAuth, auth.requirePermiso("seguridad.usuarios")], seguridadCtr.putUsuario);
router.put("/put-usuario-estado", [auth.ensureAuth, auth.requirePermiso("seguridad.usuarios")], seguridadCtr.putUsuarioEstado);
router.delete("/delete-usuario/:_id", [auth.ensureAuth, auth.requirePermiso("seguridad.usuarios")], seguridadCtr.deleteUsuario);

export default router;
