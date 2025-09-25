export default (io) => {

    io.on('connection', (socket) => {

        socket.on("disconnect", () => {
            console.log(socket.id, "desconectado");
        });


    })
}