import planillaCtr from "../controllers/planilla.controllers";
import authHttp from "../middleware/authHttp";
import express from 'express';

const router = express.Router()

router.post('/post-planilla-inventario',  planillaCtr.postPlanilla);
router.get('/get-planilla-inventario/:mesa/:bodega',  planillaCtr.getPlanilla);
router.get('/get-planilla-resumen-inventario',  planillaCtr.getPlanillaResumen);
router.get('/get-dashboard-resumen-inventario/:bodega?/:ano?/:fecha?',  planillaCtr.getPlanillaResumenFilter);
router.get('/get-dashboard-resumen-inventario-byPlanillas/:bodega?/:ano?/:fecha?',  planillaCtr.getPlanillaResumenFilterByPlanilla);
router.get('/get-planilla-resumen-total/:planilla', planillaCtr.getResumenGeneral);
router.get('/get-planilla-resumen-inventario-excel/:bodega?/:ano?/:fecha?', planillaCtr.getExcelInventario);
router.post('/post-finalizar-planilla-inventario',  planillaCtr.postPlanillaFinaliza);
router.get('/get-validar-firmas/:planilla/:mesa',  planillaCtr.getValidateFirmados);
router.get('/get-eventos-planilla/:planilla/:mesa',  planillaCtr.getEventPlanilla);
router.get('/get-years-filter-planillas/:bodega', planillaCtr.getYearFilter);
router.get('/get-month-filter-planillas/:bodega/:ano', planillaCtr.getMonthFilter);
/*  JONATHAN ROJAS NEW ROUTES */
router.get('/get-planillasporbodega',planillaCtr.getPlanillasPorBodega);
router.get('/get-planilla-inventarioSeleccionado-excel/:planilla?/:bodega?/:fecha_inventario?', planillaCtr.getInventarioPorPlanillaBodega);
router.get('/get-planilla-inventario-revisoria-fiscal-excel/:planilla?/:bodega?/:fecha_inventario?',planillaCtr.getInventarioRevisoriaFiscal);
router.get('/get-planilla-inventario-detallado-mesayconteo/:planilla?/:bodega?/:fecha_inventario?',planillaCtr.getInventarioDetalladomesayconteo);


export default router;