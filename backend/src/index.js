import './loadEnv';
import express from 'express';
import os from 'os';
const app = express();
/* MORGAN es un middlaware para logggin de solicitudes HTTP  */
import morgan from 'morgan';
import http from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { success, error } from "consola";
import IndexRoutes from './routes/index.routes'
/* SOCKET IO */
import { Server as WebSocketServer } from "socket.io";
import Socket from "./services/socke.io";
import webSocket from "./utils/WebSockets"
/* DB */
import './db/db'
import './cron/sincronizaciones';
import { programarRefrescoSt } from './services/siesaSt.servicios';

app.set('port', process.env.PORT || 3020);
const server = http.createServer(app);

//middlewaress
/* app.use(morgan('combined')); */
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.urlencoded({extended: false}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "8mb" })); 

//Rutas
app.use('/api/v1', IndexRoutes.itemsRoutes);
app.use('/api/v1', IndexRoutes.bodegaRoutes);
app.use('/api/v1', IndexRoutes.mesaRoutes);
app.use('/api/v1', IndexRoutes.sesionRoutes);
app.use('/api/v1', IndexRoutes.personalRoutes);
app.use('/api/v1', IndexRoutes.validarBodegaRoutes);
app.use('/api/v1', IndexRoutes.planillaRoutes);
app.use('/api/v1', IndexRoutes.conteoRoutes);
app.use('/api/v1', IndexRoutes.pedidosRoutes);
app.use('/api/v1', IndexRoutes.seguridadRoutes);
app.use('/api/v1', IndexRoutes.carguesRoutes);
app.use('/api/v1', IndexRoutes.basculasRoutes);
app.use('/api/v1', IndexRoutes.muellesRoutes);
app.use('/api/v1', IndexRoutes.motivosOmisionRoutes);
app.use('/api/v1', IndexRoutes.tarasEmpaquesRoutes);
app.use('/api/v1', IndexRoutes.hojasRutaRoutes);
app.use('/api/v1', IndexRoutes.vehiculosRoutes);
app.use('/api/v1', IndexRoutes.reaprovisionamientosRoutes);
app.use('/api/v1', IndexRoutes.pisoRoutes);
app.use('/api/v1', IndexRoutes.firmantesRoutes);
app.use('/api/v1', IndexRoutes.conductorRoutes);
app.use('/api/v1', IndexRoutes.liquidacionRoutes);

const ipsLan = () =>
    Object.values(os.networkInterfaces())
        .flat()
        .filter((iface) => iface && !iface.internal && (iface.family === 'IPv4' || iface.family === 4))
        .map((iface) => iface.address);

//Inicio del servidor
const puerto = app.get('port');
const httpServer = server.listen(puerto, '0.0.0.0', () => {
    success({ message: `API local  http://127.0.0.1:${puerto}`, badge: true });
    ipsLan().forEach((ip) => {
        success({ message: `API red   http://${ip}:${puerto}`, badge: true });
    });
    programarRefrescoSt();
});
httpServer.timeout = 200000;
httpServer.headersTimeout = 210000;
httpServer.requestTimeout = 200000;

global.io = new WebSocketServer(httpServer, {
    cors: { origin: true, credentials: true },
    pingInterval: 1000,
    pingTimeout: 1000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
})

Socket(io)
global.io.on('connection', webSocket.connection)

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection (el servidor sigue activo):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error('Puerto ocupado, saliendo para que nodemon reinicie.');
        process.exit(1);
    }
    console.error('Uncaught exception (el servidor sigue activo):', err?.message || err);
});
