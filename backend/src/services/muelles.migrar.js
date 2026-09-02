import mongoose from "mongoose";
import bodegaModel from "../models/bodega.models";
import muelleModel from "../models/muelles.models";
import basculaModel from "../models/basculas.models";

const esObjectId = (valor) =>
  mongoose.isValidObjectId(valor) && String(valor).length === 24 && !/^\d+$/.test(String(valor));

const asegurarMuellesBodega = async (bodega, cantidad) => {
  const existentes = await muelleModel.find({ bodega: bodega._id, estado: 0 }).sort({ nombre: 1 });
  if (existentes.length) return existentes;
  const n = Math.max(1, Number(cantidad) || 1);
  const creados = [];
  for (let i = 1; i <= n; i += 1) {
    creados.push(
      await new muelleModel({
        nombre: `Muelle ${i}`,
        bodega: bodega._id,
      }).save()
    );
  }
  return creados;
};

export const migrarMuelles = async () => {
  const bodegas = await bodegaModel.find({ estado: 0 }).lean();
  for (const bodega of bodegas) {
    const hay = await muelleModel.exists({ bodega: bodega._id, estado: 0 });
    if (hay) continue;
    const hayBascula = await basculaModel.collection.findOne({ bodega: bodega._id, estado: 0 });
    const n = Math.max(1, Number(bodega.muellesDespacho) || 1);
    if (!hayBascula && n <= 1 && bodega.codigo !== "PT001") continue;
    const cantidad = bodega.codigo === "PT001" ? Math.max(n, 3) : n;
    await asegurarMuellesBodega(bodega, cantidad);
  }

  const crudas = await basculaModel.collection
    .find({
      estado: 0,
      $or: [{ muelle: { $type: "int" } }, { muelle: { $type: "double" } }, { muelle: { $type: "long" } }],
    })
    .toArray();

  for (const row of crudas) {
    const num = Number(row.muelle);
    if (!Number.isInteger(num) || num < 1) continue;
    const lista = await asegurarMuellesBodega({ _id: row.bodega }, num);
    const dock =
      lista.find((item) => item.nombre === `Muelle ${num}`) || lista[num - 1] || lista[0];
    if (!dock) continue;
    await basculaModel.collection.updateOne({ _id: row._id }, { $set: { muelle: dock._id } });
  }
};

export const idMuelle = (valor) => {
  if (!valor) return "";
  if (typeof valor === "object" && valor._id) return String(valor._id);
  return esObjectId(valor) ? String(valor) : "";
};

export default { migrarMuelles, idMuelle };
