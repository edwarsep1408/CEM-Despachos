import express from "express";
import auth from "../middleware/authHttp";
import liquidacionCtr from "../controllers/liquidacion.controllers";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.liquidacion", "despacho.hojas-ruta")];

router.get("/get-liquidacion-avance", permiso, liquidacionCtr.getAvance);
router.get("/get-liquidacion-hojas", permiso, liquidacionCtr.getHojas);
router.get("/get-liquidacion-hoja/:hojaId", permiso, liquidacionCtr.getHoja);
router.get("/get-liquidacion-historico", permiso, liquidacionCtr.getHistorico);
router.put("/put-liquidacion-cierre/:hojaId", permiso, liquidacionCtr.guardarCierre);
router.post("/post-liquidacion-consignacion/:hojaId", permiso, liquidacionCtr.agregarConsignacion);
router.delete(
  "/delete-liquidacion-consignacion/:hojaId/:consignacionId",
  permiso,
  liquidacionCtr.eliminarConsignacion
);
router.put("/put-liquidacion-gastos/:hojaId", permiso, liquidacionCtr.guardarGastos);
router.post("/post-liquidacion-aprobar/:hojaId", permiso, liquidacionCtr.aprobar);
router.post("/post-liquidacion-rechazar/:hojaId", permiso, liquidacionCtr.rechazar);

export default router;
