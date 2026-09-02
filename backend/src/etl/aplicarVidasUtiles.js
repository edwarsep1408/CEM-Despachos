import "../loadEnv";
import mongoose from "mongoose";
import db from "../key";
import { aplicarVidasUtilesAItems } from "../services/vidaUtil.servicios";
import { aplicarEmpaquesAItems } from "../services/empaqueItems.servicios";

(async () => {
  await mongoose.connect(db.MONGODB_URI);
  const vidas = await aplicarVidasUtilesAItems();
  const empaques = await aplicarEmpaquesAItems();
  console.log("VIDA_UTIL_OK", JSON.stringify(vidas));
  console.log("EMPAQUE_OK", JSON.stringify(empaques));
  await mongoose.disconnect();
  process.exit(0);
})().catch((error) => {
  console.error("VIDA_UTIL_FAIL", error.message);
  process.exit(1);
});
