import express from "express";
import firmanteCtr from "../controllers/firmantes.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();
const admin = [auth.ensureAuth, auth.requireAnyPermiso("despacho.firmantes")];
const lectura = [
  auth.ensureAuth,
  auth.requireAnyPermiso("despacho.firmantes", "despacho.hojas-ruta"),
];

router.get("/get-firmantes-cargos", lectura, firmanteCtr.getCargos);
router.get("/get-firmantes", lectura, firmanteCtr.getFirmantes);
router.get("/get-mi-firma", [auth.ensureAuth], firmanteCtr.getMiFirma);
router.put("/put-mi-firma", [auth.ensureAuth], firmanteCtr.putMiFirma);
router.post("/post-firmante", admin, firmanteCtr.postFirmante);
router.put("/put-firmante", admin, firmanteCtr.updateFirmante);
router.delete("/delete-firmante/:_id", admin, firmanteCtr.deleteFirmante);

export default router;
