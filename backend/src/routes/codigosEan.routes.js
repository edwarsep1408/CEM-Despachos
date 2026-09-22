import express from "express";
import multer from "multer";
import auth from "../middleware/authHttp";
import eanCtr from "../controllers/codigosEan.controllers";

const router = express.Router();
const permiso = [
  auth.ensureAuth,
  auth.requireAnyPermiso("despacho.codigos-ean", "despacho.ordenes-compra", "items.ver"),
];
const csv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

router.get("/get-codigos-ean", permiso, eanCtr.getAll);
router.post("/post-codigo-ean", permiso, eanCtr.post);
router.put("/put-codigo-ean", permiso, eanCtr.put);
router.delete("/delete-codigo-ean/:_id", permiso, eanCtr.delete);
router.post("/post-codigos-ean-csv", permiso, csv.single("archivo"), eanCtr.importarCsv);

export default router;
