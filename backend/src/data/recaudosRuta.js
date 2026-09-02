export const TIPOS_RECAUDO = [
  { codigo: "CORRESPONSAL", nombre: "Corresponsal / Wompi", banco: "Bancolombia" },
  { codigo: "PAGO_PROVEEDORES", nombre: "Pago a proveedores", banco: "Bancolombia" },
  { codigo: "TRANSFERENCIA", nombre: "Transferencia app", banco: "Bancolombia" },
  { codigo: "NEQUI", nombre: "Nequi", banco: "Nequi" },
  { codigo: "RECAUDO_EMPRESARIAL", nombre: "Recaudo empresarial (Davivienda)", banco: "Davivienda" },
  { codigo: "OTRO", nombre: "Otro comprobante", banco: "" },
];

export const bancoPorTipo = (codigo) => {
  const hit = TIPOS_RECAUDO.find((t) => t.codigo === String(codigo || "").toUpperCase());
  if (!hit) return "Bancolombia";
  return hit.banco || "";
};

const num = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

export const tipoRecaudoValido = (codigo) =>
  TIPOS_RECAUDO.some((t) => t.codigo === String(codigo || "").toUpperCase());

export const etiquetaTipoRecaudo = (codigo) =>
  TIPOS_RECAUDO.find((t) => t.codigo === String(codigo || "").toUpperCase())?.nombre ||
  codigo ||
  "";

export const evaluarRecaudo = ({
  valorFactura = 0,
  valorNovedad = 0,
  tipoPago = "CONTADO",
  recaudos = [],
} = {}) => {
  const factura = Math.max(0, Math.round(num(valorFactura)));
  const novedad = Math.max(0, Math.round(num(valorNovedad)));
  const credito = String(tipoPago || "").toUpperCase() === "CREDITO";
  const totalRecaudado = Math.round(
    (recaudos || []).reduce((acc, row) => acc + num(row?.monto), 0)
  );
  const esperado = Math.max(0, factura - novedad);
  const diferencia = esperado - totalRecaudado;
  let estado = "sin_recaudo";
  if (credito && totalRecaudado <= 0) estado = "no_aplica";
  else if (esperado <= 0 && totalRecaudado <= 0) estado = "no_aplica";
  else if (Math.abs(diferencia) <= 1) estado = "cuadrado";
  else if (diferencia > 1) estado = "falta";
  else estado = "exceso";
  return {
    valorFactura: factura,
    valorNovedad: novedad,
    esperado,
    totalRecaudado,
    diferencia,
    estado,
    credito,
  };
};
