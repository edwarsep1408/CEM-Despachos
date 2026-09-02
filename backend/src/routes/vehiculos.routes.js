import express from "express";
import auth from "../middleware/authHttp";
import vehiculoCtr from "../controllers/vehiculos.controllers";

const router = express.Router();
const ver = [auth.ensureAuth, auth.requireAnyPermiso("vehiculos.ver", "despacho.hojas-ruta")];
const editar = [auth.ensureAuth, auth.requireAnyPermiso("vehiculos.ver")];

router.get("/get-vehiculos", ver, vehiculoCtr.getVehiculos);
router.post("/post-vehiculo", editar, vehiculoCtr.postVehiculo);
router.put("/put-vehiculo", editar, vehiculoCtr.updateVehiculo);
router.delete("/delete-vehiculo/:_id", editar, vehiculoCtr.deleteVehiculo);

export default router;
