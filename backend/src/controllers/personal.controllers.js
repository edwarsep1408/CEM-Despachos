import personalModel from '../models/personal.models'

const personalCtr = {}

personalCtr.postPersonal = async (req, res) => {
    const body = req.body;

    try {

        const validacionPersonal = await personalModel.findOne({
            'nombre': body.nombre,
            'estado': 0
        });

        if (validacionPersonal) {
            return res.status(400).json({
                status: 400,
                body: { message: 'La Personal ya esta registrada' },
                error: false
            });
        }



        const newPersonal = new personalModel(body);

        const storagePersonal = await newPersonal.save();

        if (!storagePersonal) {
            return res.status(404).json({
                status: 404,
                body: { message: 'No se guardó el Personal' },
                error: false
            });
        }

        return res.status(200).json({
            status: 200,
            body: storagePersonal,
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

personalCtr.getPersonals = async (req, res) => {
    try {
        console.log("CONSULTAR COLABORADORES");
        
        const Personals = await personalModel.find({ estado: 0 }).populate('bodega').populate('mesa');

        if (Personals.length === 0) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se encontraron personal' },
                error: false
            })
        } else {
            res.status(200).json({
                status: 200,
                body: Personals,
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

personalCtr.getPersonal = async (req, res) => {
    try {

        const { _id } = req.params

        const personal = await personalModel.findOne({ _id, estado: 0 }).populate('bodega').populate('mesa');

        if (personal.length === 0) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se encontraron personal' },
                error: false
            })
        } else {
            res.status(200).json({
                status: 200,
                body: personal,
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

personalCtr.getPersonalBodega = async (req, res) => {

    const { bodega } = req.params

    try {
        const Personal = await personalModel.find({ bodega, estado: 0 }).populate('bodega');

        if (Personal.length === 0) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se encontraron la Personal' },
                error: false
            })
        } else {
            res.status(200).json({
                status: 200,
                body: Personal,
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

personalCtr.updatePersonal = async (req, res) => {
    const body = req.body;

    try {

        const Personal = await personalModel.findByIdAndUpdate({ '_id': body._id }, body, { new: true }).exec();

        if (!Personal) {
            return res.status(404).json({ status: 404, body: { message: 'No se pudo actualizar la Personal' }, error: false });
        }

        return res.status(200).json({ status: 200, body: Personal, error: false });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, body: { message: 'Hay un error en el servidor' }, error: true });
    }
};

personalCtr.deletePersonal = async (req, res) => {

    try {

        const { _id } = req.params

        const result = await personalModel.findByIdAndDelete({ _id }, { "estado": 2 })

        if (!result) {
            res.status(404).json({
                status: 404,
                body: { message: 'No se pudo eliminar la Personal' },
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

export default personalCtr