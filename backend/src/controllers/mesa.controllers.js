import mesaModel from '../models/mesa.models'

const mesaCtr = {}

mesaCtr.postMesa = async (req, res) => {
    const body = req.body;

    try {

        const validacionMesa = await mesaModel.findOne({
            'nombre': body.nombre,
            'estado': 0
        });

        if (validacionMesa) {
            return res.status(400).json({
                status: 400,
                body: { message: 'La Mesa ya esta registrada' },
                error: false
            });
        }



        const newMesa = new mesaModel(body);

        const storageMesa = await newMesa.save();

        if (!storageMesa) {
            return res.status(404).json({
                status: 404,
                body: { message: 'No se guardó la Mesa' },
                error: false
            });
        }

        return res.status(200).json({
            status: 200,
            body: storageMesa,
            error: false
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        });
    }
};

mesaCtr.getMesas = async (req, res) => {
    try {
        const Mesas = await mesaModel.find({ estado: 0 }).populate('bodega');

        if (Mesas.length === 0) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se encontraron Mesas' },
                error: false
            })
        } else {
            res.status(200).json({
                status: 200,
                body: Mesas,
                error: false
            })
        }
    } catch (error) {
        res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        })
    }
}

mesaCtr.getMesaBodega = async (req, res) => {

    const { bodega } = req.params

    try {
        const mesa = await mesaModel.find({ bodega, estado: 0 }).populate('bodega');

        if (mesa.length === 0) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se encontraron la mesa' },
                error: false
            })
        } else {
            res.status(200).json({
                status: 200,
                body: mesa,
                error: false
            })
        }
    } catch (error) {
        res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        })
    }
}

mesaCtr.updateMesa = async (req, res) => {
    const body = req.body;

    try {

        const Mesa = await mesaModel.findByIdAndUpdate({ '_id': body._id }, body, { new: true }).exec();

        if (!Mesa) {
            return res.status(404).json({ status: 404, body: { message: 'No se pudo actualizar la Mesa' }, error: false });
        }

        return res.status(200).json({ status: 200, body: Mesa, error: false });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, body: { message: 'Hay un error en el servidor' }, error: true });
    }
};

mesaCtr.deleteMesa = async (req, res) => {

    try {

        const { _id } = req.params

        const result = await mesaModel.findByIdAndDelete({ _id }, { "estado": 2 })

        if (!result) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se pudo eliminar la Mesa' },
                error: false
            })
        }


        res.status(200).json({
            status: 200,
            body: result,
            error: false
        })


    } catch (error) {

        console.log(error)

        res.status(500).json({
            status: 500,
            body: { message: 'Hay un error en el servidor' },
            error: true
        })

    }

}

export default mesaCtr