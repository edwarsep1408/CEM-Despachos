import express from "express";
import motivoCtr from "../controllers/motivosOmision.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.motivos")];

router.post("/post-motivo-omision", permiso, motivoCtr.postMotivo);
router.get("/get-motivos-omision", [auth.ensureAuth, auth.requireAnyPermiso("despacho.motivos", "despacho.piso", "despacho.cargues")], motivoCtr.getMotivos);
router.put("/put-motivo-omision", permiso, motivoCtr.updateMotivo);
router.delete("/delete-motivo-omision/:_id", permiso, motivoCtr.deleteMotivo);

export default router;
