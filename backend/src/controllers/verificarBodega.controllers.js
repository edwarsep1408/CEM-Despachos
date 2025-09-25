import personalModel from "../models/personal.models";


const validaBodegaCtr = {}

validaBodegaCtr.postValidaPersonalBodega = async (req, res) => {
    const { cedula, bodega } = req.body;

    try {
        const result = await personalModel.findOne({ cedula, bodega })
            .populate('bodega')
            .populate('mesa')

            console.log(result)

        if (!result) {
            return res.status(404).json({
                status: 404,
                body: { message: 'No se encuentra en ninguna mesa de esta bodega' },
                error: false
            });
        }

        res.status(200).json({
            status: 200,
            body: result,
            error: false
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        });
    }
};


export default validaBodegaCtr