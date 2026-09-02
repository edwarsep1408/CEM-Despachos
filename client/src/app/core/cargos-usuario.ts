export const CARGOS_USUARIO = [
  { codigo: "SUPERVISOR_LOGISTICA", etiqueta: "Supervisor de logística", firmaCertificado: true },
  { codigo: "AUXILIAR_CALIDAD", etiqueta: "Auxiliar de calidad", firmaCertificado: true },
  { codigo: "DESPACHADOR", etiqueta: "Despachador", firmaCertificado: false },
  { codigo: "FACTURADOR", etiqueta: "Facturador", firmaCertificado: false },
];

export const esCargoFirma = (codigo?: string) =>
  Boolean(CARGOS_USUARIO.find((item) => item.codigo === codigo)?.firmaCertificado);

export const etiquetaCargo = (codigo?: string) =>
  CARGOS_USUARIO.find((item) => item.codigo === codigo)?.etiqueta || codigo || "—";
