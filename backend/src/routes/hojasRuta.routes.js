import express from "express";
import auth from "../middleware/authHttp";
import hojaCtr from "../controllers/hojasRuta.controllers";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.hojas-ruta")];

router.get("/get-hojas-ruta", permiso, hojaCtr.getHojas);
router.get("/get-hoja-ruta-impresion/:_id", permiso, hojaCtr.getImpresion);
router.get("/get-hoja-ruta/:_id", permiso, hojaCtr.getHoja);
router.post("/post-hoja-ruta", permiso, hojaCtr.postHoja);
router.get("/get-documentos-hoja-ruta", permiso, hojaCtr.getDocumentosDisponibles);
router.get("/get-facturas-siesa", permiso, hojaCtr.getFacturas);
router.put("/put-hoja-ruta-documentos", permiso, hojaCtr.agregarDocumentos);
router.put("/put-hoja-ruta-factura", permiso, hojaCtr.agregarPorFactura);
router.put("/put-hoja-ruta-facturas", permiso, hojaCtr.agregarFacturasSiesa);
router.put("/put-hoja-ruta", permiso, hojaCtr.actualizarHoja);
router.put("/put-hoja-ruta-eliminar-documentos", permiso, hojaCtr.eliminarDocumentos);
router.put("/put-hoja-ruta-confirmar/:_id", permiso, hojaCtr.confirmarHoja);
router.put("/put-hoja-ruta-anular/:_id", permiso, hojaCtr.anularHoja);

export default router;
