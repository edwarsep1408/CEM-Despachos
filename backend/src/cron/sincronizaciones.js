import bodegaServicios from '../services/bodejas.servicios.js';
import { ejecutarEtlPedidosSiesa } from '../etl/pedidosSiesa.etl';
import cron from 'node-cron';

/* Se llama al servicio que contiene la  sincronización con sistema1 y se procede a guardar en la BD para tener un historico propio */
cron.schedule('0 0 * * *', () => {

     bodegaServicios.SincronizacionInventarioUnoee();
    
});

/* Pedidos SIESA: apagado por ahora. Activar con SIESA_PEDIDOS_CRON=true */
if (process.env.SIESA_PEDIDOS_CRON === 'true') {
    cron.schedule(process.env.SIESA_PEDIDOS_CRON_EXPR || '0 6 * * *', () => {
        ejecutarEtlPedidosSiesa({ usuario: 'cron' })
            .then((resultado) => {
                console.log('ETL pedidos SIESA (cron):', resultado);
            })
            .catch((error) => {
                console.error('ETL pedidos SIESA (cron) falló:', error.message);
            });
    });
}

