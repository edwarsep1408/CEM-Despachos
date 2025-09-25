import axios from "axios";


const sesionCtr = {}

const API_URL = 'http://192.168.1.252:5000/api/v1/validar-sesion';

sesionCtr.validarSesion = async (req, res) => {
    const { token } = req.body;
    
    try {
        const options = {
            headers: {
                AuthorizationApi: token
            }
        };
        const response = await axios.post(API_URL, { token }, options);
        const responseData = response.data.body; // Desestructurar la respuesta para obtener datos específicos

        res.status(response.status).json(responseData);
        
    } catch (error) {
        if (error.response) {

            res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // La solicitud fue hecha pero no se recibió ninguna respuesta
            res.status(500).json({
                status: 500,
                body: { message: 'No se recibió respuesta del servidor' },
                error: true
            });
        } else {
            // Se produjo un error al configurar la solicitud
            res.status(500).json({
                status: 500,
                body: { message: 'Error al configurar la solicitud' },
                error: true
            });
        }
    }
};



export default sesionCtr;

