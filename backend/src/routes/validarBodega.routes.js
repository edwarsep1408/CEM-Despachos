import express, { Router } from "express";
import validarBodega from "../controllers/verificarBodega.controllers";
import auth from "../middleware/authHttp";
const router = express.Router()

router.post('/post-validar-personal-bodega', validarBodega.postValidaPersonalBodega)

export default router