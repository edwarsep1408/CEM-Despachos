import express, { Router } from "express";
import bodegaCtr from "../controllers/bodega.controllers";
import auth from "../middleware/authHttp";
const router = express.Router()

router.post('/post-bodega', [auth.ensureAuth], bodegaCtr.postBodega)
router.get('/get-bodegas',  bodegaCtr.getBodegas)
router.get('/sincronizar-bodegas-siesa', [auth.ensureAuth], bodegaCtr.sincronizarBodegasSiesa)
router.put('/put-bodega', [auth.ensureAuth], bodegaCtr.updateBodega)
router.delete('/delete-bodega/:_id', [auth.ensureAuth], bodegaCtr.deleteBodega)
router.get('/consultarInventarioBodega/:_bodega', [auth.ensureAuth], bodegaCtr.getInventarioBodega);
router.get('/inventarioTiempoReal', [auth.ensureAuth],bodegaCtr.actualizarInformacionTiemporeal);
router.get('/inventarioTotalcompania', [auth.ensureAuth], bodegaCtr.inventarioTotalCompania);
router.get('/inventarioTransito', [auth.ensureAuth], bodegaCtr.inventarioTransito);
router.get('/get-bodegas-inventario',[auth.ensureAuth], bodegaCtr.getBodegasInventarioctr);
router.get('/dashboard-indicadores-inventario', [auth.ensureAuth], bodegaCtr.dashboardIndicadoresInventario);

export default router