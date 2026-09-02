import "../loadEnv";
import mongoose from "mongoose";
import db from "../key";
import { ejecutarEtlPedidosSiesa } from "./pedidosSiesa.etl";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

(async () => {
  await mongoose.connect(db.MONGODB_URI);
  const resultado = await ejecutarEtlPedidosSiesa({
    usuario: arg("usuario") || "etl",
    desde: arg("desde"),
    hasta: arg("hasta"),
  });
  console.log("ETL_OK", JSON.stringify(resultado));
  await mongoose.disconnect();
  process.exit(0);
})().catch((error) => {
  console.error("ETL_FAIL", error.message);
  process.exit(1);
});
