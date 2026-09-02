import express from "express";
import basculaCtr from "../controllers/basculas.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();

router.post("/post-bascula", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar")], basculaCtr.postBascula);
router.get("/get-basculas", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar")], basculaCtr.getBasculas);
router.get("/get-bascula-piso", [auth.ensureAuth, auth.requireAnyPermiso("despacho.piso", "despacho.cargues", "basculas.ver")], basculaCtr.getBasculaPiso);
router.get("/get-basculas-bodega/:bodega", [auth.ensureAuth], basculaCtr.getBasculasBodega);
router.put("/put-bascula", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar")], basculaCtr.updateBascula);
router.delete("/delete-bascula/:_id", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar")], basculaCtr.deleteBascula);
router.post("/escuchar-bascula/:_id", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar", "despacho.piso", "despacho.cargues")], basculaCtr.escucharBascula);
router.post("/detener-bascula/:_id", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar", "despacho.piso", "despacho.cargues")], basculaCtr.detenerBascula);
router.post("/enviar-bascula/:_id", [auth.ensureAuth, auth.requireAnyPermiso("basculas.ver", "inventario.gestionar")], basculaCtr.enviarBascula);

export default router;
