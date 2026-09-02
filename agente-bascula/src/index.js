import "dotenv/config";
import express from "express";
import cors from "cors";
import { crearBascula } from "./bascula.js";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 3920;
const ip = (process.env.BASCULA_IP || "192.168.1.106").trim();
const puerto = Number(process.env.BASCULA_PUERTO) || 5001;

const clientes = new Set();

const avisarSse = (payload) => {
  const linea = `data: ${JSON.stringify(payload)}\n\n`;
  clientes.forEach((res) => res.write(linea));
};

const bascula = crearBascula({
  ip,
  puerto,
  onCambio: (estado) => avisarSse({ tipo: "estado", ...estado }),
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/estado", (_req, res) => {
  res.json({ body: bascula.estado() });
});

app.get("/eventos", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ tipo: "estado", ...bascula.estado() })}\n\n`);
  clientes.add(res);
  req.on("close", () => clientes.delete(res));
});

app.post("/reconectar", (_req, res) => {
  bascula.conectar();
  res.json({ body: { message: "Reconectando con la báscula.", ...bascula.estado() } });
});

app.listen(PORT, HOST, () => {
  console.log(`Agente báscula en http://${HOST}:${PORT}`);
  console.log(`Convertidor ${ip}:${puerto} (TCP client)`);
  bascula.conectar();
});
