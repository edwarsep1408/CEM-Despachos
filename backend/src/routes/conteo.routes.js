import conteoDetailsCtr from "../controllers/conteoDetails.controllers";
import authHttp from "../middleware/authHttp";
import express from 'express';
const router = express.Router()

router.post('/post-conteo-inventario',  conteoDetailsCtr.postConteo)
router.get('/get-conteo/:planilla_id/:mesa',  conteoDetailsCtr.getConteo)
router.get('/get-log-conteo/:planilla_id',  conteoDetailsCtr.getPlanillaLogs)
router.get('/get-resumen-conteo/:bodega/:mesa/:planilla',  conteoDetailsCtr.getConteoResumen)
router.get('/get-resumen-conteo-dashboard/:bodega/:mesa',  conteoDetailsCtr.getConteoResumenDashboard)
router.get('/get-resumen-conteo-details/:conteo',  conteoDetailsCtr.getConteoDetailsResumen)
router.post('/post-conteo-diferencia',  conteoDetailsCtr.postDiferenciaConteo)
router.post('/post-conteo-correccion',  conteoDetailsCtr.postCorreccionConteo)
router.post('/post-conteo-correccion-admin',  conteoDetailsCtr.postCorreccionConteoAdmin)

export default router;