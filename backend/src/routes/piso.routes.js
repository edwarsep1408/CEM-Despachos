import express from "express";
import auth from "../middleware/authHttp";
import pisoCtr from "../controllers/piso.controllers";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.piso", "despacho.cargues")];

router.get("/get-piso-cargues", permiso, pisoCtr.getCargues);
router.get("/get-piso-cargue/:_id", permiso, pisoCtr.getCargue);
router.put("/put-piso-omitir-documento", permiso, pisoCtr.omitirDocumento);
router.put("/put-piso-omitir-linea", permiso, pisoCtr.omitirLinea);
router.post("/post-piso-pesaje", permiso, pisoCtr.registrarPesaje);
router.put("/put-piso-quitar-pesaje", permiso, pisoCtr.quitarPesaje);
router.put("/put-piso-repesar", permiso, pisoCtr.repesar);
router.put("/put-piso-finalizar-documento", permiso, pisoCtr.finalizarDocumento);
router.put("/put-piso-etiquetas", permiso, pisoCtr.registrarEtiquetas);

export default router;
