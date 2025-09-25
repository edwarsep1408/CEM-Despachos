import bodegaServicios from '../services/bodejas.servicios.js';
import cron from 'node-cron';

/* Se llama al servicio que contiene la  sincronización con sistema1 y se procede a guardar en la BD para tener un historico propio */
cron.schedule('0 0 * * *', () => {

     bodegaServicios.SincronizacionInventarioUnoee();
    
});

