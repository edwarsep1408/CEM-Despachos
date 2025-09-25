import express from 'express';
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

app.set('port', process.env.PORT || 3001);
const server = http.createServer(app);

//middlewaress
/* app.use(morgan('combined')); */
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.urlencoded({extended: false}));
app.use(cors({origin:'*'}));
app.use(express.json()); 

//Rutas
app.use('/api/v1', IndexRoutes.itemsRoutes);
app.use('/api/v1', IndexRoutes.bodegaRoutes);
app.use('/api/v1', IndexRoutes.mesaRoutes);
app.use('/api/v1', IndexRoutes.sesionRoutes);
app.use('/api/v1', IndexRoutes.personalRoutes);
app.use('/api/v1', IndexRoutes.validarBodegaRoutes);
app.use('/api/v1', IndexRoutes.planillaRoutes);
app.use('/api/v1', IndexRoutes.conteoRoutes);

//Inicio del servidor
const httpServer = server.listen(app.get('port'), () => {
    success({ message: `El servidor esta  http://localhost:${app.get('port')}`, badge: true })
});

global.io = new WebSocketServer(httpServer, {
    pingInterval: 1000,
    pingTimeout: 1000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
})

Socket(io)
global.io.on('connection', webSocket.connection)
