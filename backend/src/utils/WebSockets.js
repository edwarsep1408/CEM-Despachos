import mesaModel from '../models/mesa.models'
import planillaModel from '../models/planilla_mesa.models'
import planillaEvent from '../models/planilla_event.models'
import conteoModel from '../models/conteo.models'

const WebSockets = {}


WebSockets.connection = (client) => {

  client.on("unsubscribe-room", (data) => {
    console.log(data)

    const usersInRoom = io.sockets.adapter.rooms.get(data.mesaId);
    const usersArray = Array.from(usersInRoom);
    client.leave(data.mesaId);
    io.to(data.mesaId).emit('userDisconnected', usersArray);
  });

  client.on("disconnect", () => {
    io.emit('userDisconnected', client.id);
  });

  client.on('firmar-planilla', async (data) => {

    const planillaAnterior = await planillaModel.findOne({
      mesa: data.mesaId
    }).sort({ _id: -1 }).limit(1);

    const conteo = await conteoModel.findOne({
      planilla:  planillaAnterior._id
    }).sort({ _id: -1 }).limit(1);

    await new planillaEvent({
      planilla: planillaAnterior._id,
      bodega: planillaAnterior.bodega,
      mesa: data.mesaId,
      conteo: conteo._id,
      nombreEvento: 'Firmar',
      evento: { type: 'Firmar', status: true }
    }).save()
    global.io.emit('actualizar-conteo-admin', { actualizar: true });
    global.io.to(data.mesaId).emit('firmar-planilla', { finalizar: true });
  })

  client.on('finalizar-planilla', async (data) => {

    try {

      const result = await planillaModel.findByIdAndUpdate({ _id: data._id }, { estado: 2 })

      if (result === null) {
        global.io.to(data.mesaId).emit('planilla-finalizada', { finalizar: false });
      }


      await planillaEvent.findOneAndDelete({nombreEvento: 'Firmar', mesa: data.mesaId })

      global.io.to(data.mesaId).emit('planilla-finalizada', { ...result, finalizar: true });

    } catch (error) {
      console.log(error)
    }

  })

  client.on('subscribe-room', async (data) => {

    const mesaRoom = await mesaModel.findOne({ _id: data.mesaId })

    if (mesaRoom != null) {

      client.join(data.mesaId);

      const usersInRoom = io.sockets.adapter.rooms.get(data.mesaId);
      const usersArray = Array.from(usersInRoom);
      console.log(usersArray)
      io.to(data.mesaId).emit('usersInRoom', usersArray);

      console.log(client.id)

      global.io.to(client.id).emit('subcribed-room', {
        status: true,
        text: 'Ahora está conectado',
        created: Date.now(),
        userId: client.id,
        dataRoom: mesaRoom
      })
    }
  })
  client.on("latencyTest", (startTime) => {
    const responseTime = Date.now();
    global.io.emit("latencyResponse", responseTime);
  });

}


module.exports = WebSockets;