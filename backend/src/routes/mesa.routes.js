import express, { Router } from "express";
import mesaCtr from "../controllers/mesa.controllers"
import auth from "../middleware/authHttp";
const router = express.Router()

router.post('/post-mesa', [auth.ensureAuth], mesaCtr.postMesa)
router.get('/get-mesas', [auth.ensureAuth], mesaCtr.getMesas)
router.get('/get-mesa-bodega/:bodega', [auth.ensureAuth], mesaCtr.getMesaBodega)
router.put('/put-mesa', [auth.ensureAuth], mesaCtr.updateMesa)
router.delete('/delete-mesa/:_id', [auth.ensureAuth], mesaCtr.deleteMesa)

export default router