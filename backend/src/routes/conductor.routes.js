import express from "express";
import auth from "../middleware/authHttp";
import conductorCtr from "../controllers/conductor.controllers";

const router = express.Router();
const portal = [auth.ensureAuth, auth.requirePermiso("despacho.conductor")];

router.post("/post-login-conductor", conductorCtr.login);
router.get("/get-conductor-hojas", portal, conductorCtr.getHojas);
router.get("/get-conductor-hoja/:hojaId", portal, conductorCtr.getHoja);
router.get("/get-conductor-factura/:hojaId/:docId", portal, conductorCtr.getFactura);
router.post("/post-conductor-leer-comprobante", portal, conductorCtr.leerComprobante);
router.put("/put-conductor-entrega/:hojaId/:docId", portal, conductorCtr.guardarEntrega);
router.post("/post-conductor-cerrar-ruta/:hojaId", portal, conductorCtr.cerrarRuta);
router.post("/post-conductor-consignacion/:hojaId", portal, conductorCtr.agregarConsignacion);
router.delete(
  "/delete-conductor-consignacion/:hojaId/:consignacionId",
  portal,
  conductorCtr.eliminarConsignacion
);
router.put("/put-conductor-liquidacion/:hojaId", portal, conductorCtr.enviarLiquidacion);

export default router;
