export const CARGOS_USUARIO = {
  SUPERVISOR_LOGISTICA: {
    etiqueta: "Supervisor de logística",
    firmaCertificado: true,
  },
  AUXILIAR_CALIDAD: {
    etiqueta: "Auxiliar de calidad",
    firmaCertificado: true,
  },
  DESPACHADOR: {
    etiqueta: "Despachador",
    firmaCertificado: false,
  },
  FACTURADOR: {
    etiqueta: "Facturador",
    firmaCertificado: false,
  },
};

export const CODIGOS_CARGO = Object.keys(CARGOS_USUARIO);

export const normalizarCargo = (valor) => {
  const cargo = String(valor || "").trim().toUpperCase();
  return CARGOS_USUARIO[cargo] ? cargo : "";
};

export const esCargoFirma = (valor) => {
  const cargo = normalizarCargo(valor);
  return Boolean(cargo && CARGOS_USUARIO[cargo].firmaCertificado);
};

export const etiquetaCargo = (valor) => {
  const cargo = normalizarCargo(valor);
  return cargo ? CARGOS_USUARIO[cargo].etiqueta : "";
};

export const listaCargos = () =>
  CODIGOS_CARGO.map((codigo) => ({
    codigo,
    etiqueta: CARGOS_USUARIO[codigo].etiqueta,
    firmaCertificado: CARGOS_USUARIO[codigo].firmaCertificado,
  }));
