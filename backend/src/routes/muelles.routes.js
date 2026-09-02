import express from "express";
import muelleCtr from "../controllers/muelles.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();

const ver = ["despacho.muelles", "basculas.ver", "despacho.cargues", "inventario.gestionar"];
const piso = ["despacho.piso", "despacho.cargues", "despacho.muelles", "basculas.ver"];

router.post("/post-muelle", [auth.ensureAuth, auth.requireAnyPermiso(...ver)], muelleCtr.postMuelle);
router.get("/get-muelles", [auth.ensureAuth, auth.requireAnyPermiso(...ver)], muelleCtr.getMuelles);
router.get("/get-muelles-piso", [auth.ensureAuth, auth.requireAnyPermiso(...piso)], muelleCtr.getMuellesPiso);
router.get("/get-muelles-bodega/:bodega", [auth.ensureAuth], muelleCtr.getMuellesBodega);
router.put("/put-muelle", [auth.ensureAuth, auth.requireAnyPermiso(...ver)], muelleCtr.updateMuelle);
router.delete("/delete-muelle/:_id", [auth.ensureAuth, auth.requireAnyPermiso(...ver)], muelleCtr.deleteMuelle);

export default router;
