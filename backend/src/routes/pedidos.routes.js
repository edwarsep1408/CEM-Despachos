import express from "express";
import authHttp from "../middleware/authHttp";
import pedidosCtr from "../controllers/pedidos.controllers";

const router = express.Router();

router.get("/get-pedidos", [authHttp.ensureAuth], pedidosCtr.getPedidos);
router.get("/get-pedido/:idEnc", [authHttp.ensureAuth], pedidosCtr.getPedido);
router.get(
  "/sincronizar-pedidos-siesa",
  [authHttp.ensureAuth],
  pedidosCtr.sincronizarPedidosSiesa
);
router.get(
  "/informacion-ultima-sincronizacion-pedidos",
  [authHttp.ensureAuth],
  pedidosCtr.informacionUltimaSincronizacion
);
router.post(
  "/cancelar-sincronizacion-pedidos",
  [authHttp.ensureAuth],
  pedidosCtr.cancelarSincronizacionPedidos
);
router.get(
  "/get-pedidos-compromiso",
  [authHttp.ensureAuth, authHttp.requireAnyPermiso("despacho.compromisos", "despacho.pedidos")],
  pedidosCtr.getPedidosCompromiso
);
router.put(
  "/put-pedidos-comprometer",
  [authHttp.ensureAuth, authHttp.requirePermiso("despacho.compromisos")],
  pedidosCtr.comprometerPedidos
);
router.get(
  "/get-compromisos-log",
  [authHttp.ensureAuth, authHttp.requireAnyPermiso("despacho.compromisos", "despacho.pedidos")],
  pedidosCtr.getCompromisosLog
);

export default router;
