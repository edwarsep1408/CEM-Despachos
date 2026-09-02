import "./loadEnv";
import mongoose from "mongoose";
import db from "./key";
import { ejecutarEtlPedidosSiesa } from "./etl/pedidosSiesa.etl";

(async () => {
  await mongoose.connect(db.MONGODB_URI);
  const resultado = await ejecutarEtlPedidosSiesa({
    usuario: "admin",
    desde: "2026-08-01",
    hasta: "2026-08-25",
  });
  console.log("ETL_OK", JSON.stringify(resultado));
  await mongoose.disconnect();
  process.exit(0);
})().catch((error) => {
  console.error("ETL_FAIL", error.message);
  process.exit(1);
});
