import express from "express";
import multer from "multer";
import auth from "../middleware/authHttp";
import locCtr from "../controllers/localizaciones.controllers";

const router = express.Router();
const permiso = [
  auth.ensureAuth,
  auth.requireAnyPermiso(
    "despacho.localizaciones",
    "despacho.codigos-ean",
    "despacho.ordenes-compra",
    "items.ver"
  ),
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

router.get("/get-localizaciones", permiso, locCtr.getAll);
router.post("/post-localizacion", permiso, locCtr.post);
router.put("/put-localizacion", permiso, locCtr.put);
router.delete("/delete-localizacion/:_id", permiso, locCtr.delete);
router.post(
  "/post-localizaciones-archivo",
  permiso,
  upload.single("archivo"),
  locCtr.importarArchivo
);
router.post("/post-localizaciones-plantilla", permiso, locCtr.importarPlantilla);

export default router;
