import mongoose from "mongoose";
import db from "../key";
import { sembrarVehiculos } from "../controllers/vehiculos.controllers";
import { cargarCatalogoVehiculos } from "../data/vehiculos.catalogo";
import vehiculoModel from "../models/vehiculos.models";

const run = async () => {
  await mongoose.connect(db.MONGODB_URI);
  const catalogo = cargarCatalogoVehiculos();
  await sembrarVehiculos();
  const activos = await vehiculoModel.countDocuments({ estado: 0 });
  const muestra = await vehiculoModel
    .find({ estado: 0, placa: { $in: ["WCP272", "BEM601", "JRL216", "NLW172"] } })
    .sort({ idVehiculo: 1 })
    .lean();
  console.log(JSON.stringify({ catalogo: catalogo.length, activos, muestra }, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
