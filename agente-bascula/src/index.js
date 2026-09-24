import "dotenv/config";
import express from "express";
import cors from "cors";
import { crearBascula } from "./bascula.js";
import { configImpresora, enviarTspl } from "./impresora.js";

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
app.use(express.json({ limit: "8mb" }));

app.get("/estado", (_req, res) => {
  const tsc = configImpresora();
  res.json({
    body: {
      ...bascula.estado(),
      impresora: { ip: tsc.ip, puerto: tsc.puerto },
    },
  });
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

/** Banderines TSPL → TSC MH241T en la misma LAN del muelle. */
app.post("/imprimir-tspl", async (req, res) => {
  try {
    const { tsplBase64, ip: ipOverride, puerto: puertoOverride } = req.body || {};
    const b64 = String(tsplBase64 || "").replace(/^data:.*?;base64,/, "").trim();
    if (!b64) {
      return res.status(400).json({ body: { message: "Falta tsplBase64." }, error: true });
    }
    const buffer = Buffer.from(b64, "base64");
    if (!buffer.length) {
      return res.status(400).json({ body: { message: "El TSPL está vacío." }, error: true });
    }
    const result = await enviarTspl(buffer, {
      ip: ipOverride,
      puerto: puertoOverride,
    });
    res.json({
      body: {
        message: `Enviado a TSC ${result.ip}:${result.puerto}`,
        ...result,
      },
    });
  } catch (error) {
    console.error("imprimir-tspl:", error.message);
    res.status(502).json({
      body: { message: error.message || "No se pudo imprimir en la TSC." },
      error: true,
    });
  }
});

app.listen(PORT, HOST, () => {
  const tsc = configImpresora();
  console.log(`Agente báscula en http://${HOST}:${PORT}`);
  console.log(`Convertidor ${ip}:${puerto} (TCP client)`);
  console.log(`Impresora TSC ${tsc.ip}:${tsc.puerto}`);
  bascula.conectar();
});
