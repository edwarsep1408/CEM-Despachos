import sesionCtr from "../controllers/session.controllers";
import authHttp from "../middleware/authHttp";
import express from 'express';
const router = express.Router()

router.post('/post-validar-sesion',  sesionCtr.validarSesion);

export default router;