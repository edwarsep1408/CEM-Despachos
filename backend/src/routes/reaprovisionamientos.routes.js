import express from "express";
import multer from "multer";
import auth from "../middleware/authHttp";
import reaproCtr from "../controllers/reaprovisionamientos.controllers";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.reaprovisionamiento", "despacho.pedidos", "despacho.cargues")];
const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get("/get-reaprovisionamientos", permiso, reaproCtr.listar);
router.get("/get-reaprovisionamiento-items", permiso, reaproCtr.buscarItems);
router.get("/get-reaprovisionamiento/:_id", permiso, reaproCtr.getUno);
router.post("/post-reaprovisionamiento", permiso, reaproCtr.crear);
router.post("/post-reaprovisionamiento-excel", permiso, excel.single("archivo"), reaproCtr.importarExcel);
router.put("/put-reaprovisionamiento", permiso, reaproCtr.actualizar);
router.put("/put-reaprovisionamiento-aprobar/:_id", permiso, reaproCtr.aprobar);
router.put("/put-reaprovisionamiento-anular/:_id", permiso, reaproCtr.anular);
router.put("/put-reaprovisionamiento-siesa/:_id", permiso, reaproCtr.enviarSiesa);

export default router;
