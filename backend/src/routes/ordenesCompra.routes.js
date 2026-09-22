import express from "express";
import multer from "multer";
import auth from "../middleware/authHttp";
import ocCtr from "../controllers/ordenesCompra.controllers";

const router = express.Router();
const permiso = [
  auth.ensureAuth,
  auth.requireAnyPermiso("despacho.ordenes-compra", "despacho.cargues", "despacho.pedidos"),
];
const hse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    if (name.endsWith(".hse") || name.endsWith(".txt") || file.mimetype?.includes("text")) {
      return cb(null, true);
    }
    return cb(new Error("Solo se admiten archivos .hse"));
  },
});

router.get("/get-ordenes-compra", permiso, ocCtr.listar);
router.get("/get-orden-compra/:_id", permiso, ocCtr.getUno);
router.post("/post-orden-compra-hse", permiso, hse.single("archivo"), ocCtr.importarHse);
router.put("/put-orden-compra-anular/:_id", permiso, ocCtr.anular);

export default router;
