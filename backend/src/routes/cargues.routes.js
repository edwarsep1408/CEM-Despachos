import express from "express";
import auth from "../middleware/authHttp";
import carguesCtr from "../controllers/cargues.controllers";

const router = express.Router();

router.get(
  "/get-bodegas-pedidos",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.cargues", "despacho.asignacion-bodega")],
  carguesCtr.getBodegasPedidos
);
router.get(
  "/get-cargues-pendientes",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.getPendientes
);
router.get(
  "/get-cargue/:_id",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.getCargue
);
router.post(
  "/post-cargue",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.postCargue
);
router.get(
  "/get-documentos-cargue",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.getDocumentosDisponibles
);
router.put(
  "/put-cargue-documentos",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.agregarDocumentos
);
router.put(
  "/put-cargue-eliminar-documentos",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.eliminarDocumentos
);
router.put(
  "/put-cargue-enviar/:_id",
  [auth.ensureAuth, auth.requirePermiso("despacho.cargues")],
  carguesCtr.enviarADespachos
);
router.put(
  "/put-cargue-devolver-despachos/:_id",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.estado-cargues", "despacho.cargues")],
  carguesCtr.devolverADespachos
);
router.get(
  "/get-estado-cargues",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.estado-cargues", "despacho.cargues")],
  carguesCtr.getEstadoCargues
);
router.get(
  "/get-estado-cargue/:_id",
  [auth.ensureAuth, auth.requireAnyPermiso("despacho.estado-cargues", "despacho.cargues")],
  carguesCtr.getEstadoCargue
);

export default router;
