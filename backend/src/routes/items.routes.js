import itemsCtr from "../controllers/items.controllers";
import authHttp from "../middleware/authHttp";
import express from 'express';
import itemsModels from "../models/items.models";
import multer from "../utils/multer";

const router = express.Router()

/* router.get('/get-sincronizar-items',  itemsCtr.getSincronizarItemsSiesa);  check route para eliminar */

router.get('/get-items', [authHttp.ensureAuth], itemsCtr.getItems);
router.put('/put-item', [authHttp.ensureAuth], itemsCtr.putItemLocal);
router.post('/get-items-search',  itemsCtr.getSearchItem);
router.post('/post-sincronzacionExcel',multer.single('cargarExcel'), itemsCtr.sincronizacionItemsExcel);
router.get('/sincronizar-referencias-unoee', itemsCtr.SincronizarReferenciasUnoee);
router.get('/informacion-ultima-sincronizacion-items', itemsCtr.informacionUltimaSincronizacionItems);
export default router