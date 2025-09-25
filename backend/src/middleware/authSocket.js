export default async (socket, next) => {
    try {
        const token = socket.handshake.headers.token;

        if (!token || token !== 'S0p0rt35') {
            throw new Error('Acceso no autorizado. Token inválido.');
        }

        return next();
    } catch (error) {
        console.error('Error de autenticación:', error.message);
        return next(new Error('Error de autenticación.'));
    }
};

