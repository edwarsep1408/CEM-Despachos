/** Grupo UnoEE ETC — EXISTENCIAS TOTAL COMPAÑÍA (bodegas chequeadas). */
export const GRUPO_BODEGAS_CIA_ID = "ETC";

export const compararCodigoBodega = (a, b) => {
  const ca = String(a ?? "").trim().toUpperCase();
  const cb = String(b ?? "").trim().toUpperCase();
  const numA = /^[0-9]/.test(ca);
  const numB = /^[0-9]/.test(cb);
  if (numA !== numB) return numA ? -1 : 1;
  return ca.localeCompare(cb, "es", { sensitivity: "base" });
};

export const ordenarBodegasPorCodigo = (bodegas = []) =>
  [...bodegas].sort((a, b) =>
    compararCodigoBodega(
      a?.codigo ?? a?.id_bodega ?? a,
      b?.codigo ?? b?.id_bodega ?? b
    )
  );

export const CATALOGO_BODEGAS_ETC = ordenarBodegasPorCodigo([
  { codigo: "002", descripcion: "TUNEL 1" },
  { codigo: "PT001", descripcion: "PRODUCTO TERMINADO PRADO" },
  { codigo: "PT003", descripcion: "CEDI URABA" },
  { codigo: "PT002", descripcion: "CEDI NORTE" },
  { codigo: "001", descripcion: "BODEGA EL PARAMO" },
  { codigo: "BM004", descripcion: "BODEGA PROCESO MAQUILA MAXIRICOS" },
  { codigo: "PT DV", descripcion: "BODEGA DEVOLUCION LOGISTICA" },
  { codigo: "008", descripcion: "TUNEL 2" },
  { codigo: "PT004", descripcion: "CEDI SUROESTE" },
  { codigo: "PT0PV", descripcion: "BODEGA PUNTO DE VENTA BOLIVAR" },
  { codigo: "009", descripcion: "BODEGA REFRIGERADO PROCESO" },
  { codigo: "BM002", descripcion: "BODEGA MAQUILA CORTE REAL" },
  { codigo: "BM001", descripcion: "BODEGA MAQUILA AHUMADOS TOTO" },
  { codigo: "011", descripcion: "BODEGA PROCESO PLANTA" },
  { codigo: "BM003", descripcion: "BODEGA MAQUILA DESHUESE" },
  { codigo: "PT005", descripcion: "BODEGA DIZAMAR" },
  { codigo: "PT006", descripcion: "BODEGA RENTAFRIO" },
  { codigo: "PT007", descripcion: "CEDI MONTERIA" },
]);

export const BODEGAS_GRUPO_ETC = [
  ...CATALOGO_BODEGAS_ETC.map((item) => item.codigo),
  "PTDV",
];

export const normalizarCodigoBodega = (valor) =>
  String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

export const setBodegasCompania = (codigos) =>
  new Set((codigos || []).map(normalizarCodigoBodega).filter(Boolean));

export default {
  GRUPO_BODEGAS_CIA_ID,
  CATALOGO_BODEGAS_ETC,
  BODEGAS_GRUPO_ETC,
  normalizarCodigoBodega,
  setBodegasCompania,
  compararCodigoBodega,
  ordenarBodegasPorCodigo,
};
