import axios from "axios";

/**
 * Camino original (microservicio CEM puerto 5015).
 * Se conserva para rollback: INVENTARIO_EXISTENCIAS_FUENTE=cem
 */
const CEM_INVENTARIO_API =
  process.env.CEM_INVENTARIO_API || "http://192.168.1.252:5015/api/v1";
const SIESA_ID_CIA = process.env.SIESA_ID_CIA || "13";
const INVENTARIO_TIMEOUT_MS = Number(process.env.CEM_INVENTARIO_TIMEOUT_MS || 25000);

const BODEGAS_COMPANIA = [
  "002",
  "PT001",
  "PT003",
  "PT002",
  "001",
  "BM004",
  "008",
  "PT004",
  "PT0PV",
  "009",
  "BM002",
  "BM001",
  "011",
  "BM003",
  "PT006",
];

const TIPOS_BODEGA = [
  "INV143502",
  "INV143502G",
  "INV143502T",
  "INV143503",
  "INVSUBEX",
  "INVCANASTA",
  "INV143501",
];

const TIPOS_COMPANIA = [
  "INV143502",
  "INV143502G",
  "INV143502T",
  "INV143503",
  "INVSUBEX",
  "INVSUB",
  "INV143501",
];

export const consultarExistenciasCemPorBodega = async (bodega) => {
  const response = await axios.post(
    `${CEM_INVENTARIO_API}/get-existencia-inventario-bodegas`,
    {
      idCia: Number(SIESA_ID_CIA),
      bodegas: [bodega],
      tiposInventarios: TIPOS_BODEGA,
    },
    { timeout: INVENTARIO_TIMEOUT_MS }
  );
  return Array.isArray(response.data?.body) ? response.data.body : [];
};

export const consultarExistenciasCemCompania = async () => {
  const response = await axios.post(
    `${CEM_INVENTARIO_API}/get-existencia-inventario-bodegas`,
    {
      idCia: Number(SIESA_ID_CIA),
      bodegas: BODEGAS_COMPANIA,
      tiposInventarios: TIPOS_COMPANIA,
    },
    { timeout: 60000 }
  );
  return Array.isArray(response.data?.body) ? response.data.body : [];
};

export const consultarStCem = async () => {
  const response = await axios.get(
    `${CEM_INVENTARIO_API}/get-documentos-st/${SIESA_ID_CIA}`,
    { timeout: INVENTARIO_TIMEOUT_MS }
  );
  return Array.isArray(response.data?.body) ? response.data.body : [];
};

export default {
  consultarExistenciasCemPorBodega,
  consultarExistenciasCemCompania,
  consultarStCem,
};
