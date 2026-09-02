import express from "express";
import taraCtr from "../controllers/tarasEmpaques.controllers";
import auth from "../middleware/authHttp";

const router = express.Router();
const permiso = [auth.ensureAuth, auth.requireAnyPermiso("despacho.taras")];

router.post("/post-tara", permiso, taraCtr.postTara);
router.get("/get-taras", [auth.ensureAuth, auth.requireAnyPermiso("despacho.taras", "despacho.piso", "despacho.cargues")], taraCtr.getTaras);
router.put("/put-tara", permiso, taraCtr.updateTara);
router.delete("/delete-tara/:_id", permiso, taraCtr.deleteTara);

export default router;
