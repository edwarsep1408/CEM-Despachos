export const MOTIVO_ENTREGA_COMPLETA = "ENTREGADO";

export const MOTIVOS_NOVEDAD_RUTA = [
  { codigo: MOTIVO_ENTREGA_COMPLETA, nro: 0, nombre: "Entrega completa", grupo: "entrega" },
  { codigo: "1", nro: 1, nombre: "No pedido", grupo: "comercial" },
  { codigo: "2", nro: 2, nombre: "Pedido mal tomado", grupo: "comercial" },
  { codigo: "3", nro: 3, nombre: "Por vencimiento", grupo: "calidad" },
  { codigo: "4", nro: 4, nombre: "Diferencia en precio", grupo: "comercial" },
  { codigo: "5", nro: 5, nombre: "Acuerdo comercial", grupo: "comercial" },
  { codigo: "6", nro: 6, nombre: "Dirección errada", grupo: "logistica" },
  { codigo: "7", nro: 7, nombre: "Diferencia en báscula", grupo: "calidad" },
  { codigo: "8", nro: 8, nombre: "Mal facturado", grupo: "comercial" },
  { codigo: "9", nro: 9, nombre: "Entrega fuera de horario", grupo: "logistica" },
  { codigo: "10", nro: 10, nombre: "Vía cerrada", grupo: "logistica" },
  { codigo: "11", nro: 11, nombre: "Negocio cerrado", grupo: "logistica" },
  { codigo: "12", nro: 12, nombre: "Avería", grupo: "calidad" },
  { codigo: "13", nro: 13, nombre: "No cumple especificaciones", grupo: "calidad" },
  { codigo: "14", nro: 14, nombre: "Cliente sin efectivo", grupo: "comercial" },
  { codigo: "15", nro: 15, nombre: "Mal despacho", grupo: "logistica" },
  { codigo: "16", nro: 16, nombre: "Cliente sin espacio", grupo: "comercial" },
  { codigo: "17", nro: 17, nombre: "Pérdida de vacío", grupo: "calidad" },
  { codigo: "18", nro: 18, nombre: "Abombamiento", grupo: "calidad" },
  { codigo: "19", nro: 19, nombre: "Presencia de hielo o frizado", grupo: "calidad" },
  { codigo: "20", nro: 20, nombre: "Tiempo máximo de espera", grupo: "logistica" },
  { codigo: "21", nro: 21, nombre: "No entregado por el operador", grupo: "logistica" },
  { codigo: "22", nro: 22, nombre: "Orden público", grupo: "logistica" },
  { codigo: "23", nro: 23, nombre: "Extraruta", grupo: "logistica" },
  { codigo: "24", nro: 24, nombre: "Objeto extraño", grupo: "calidad" },
  { codigo: "25", nro: 25, nombre: "Producto mal marcado", grupo: "calidad" },
  { codigo: "26", nro: 26, nombre: "Producto mal empacado", grupo: "calidad" },
  { codigo: "27", nro: 27, nombre: "Producto descompuesto", grupo: "calidad" },
  { codigo: "28", nro: 28, nombre: "Sin lote o fecha de vencimiento", grupo: "calidad" },
  { codigo: "29", nro: 29, nombre: "Peso neto diferente al garantizado", grupo: "calidad" },
  { codigo: "30", nro: 30, nombre: "Diferencia en rango", grupo: "calidad" },
  { codigo: "31", nro: 31, nombre: "Presencia de fracturas", grupo: "calidad" },
  { codigo: "32", nro: 32, nombre: "Olor no característico", grupo: "calidad" },
  { codigo: "33", nro: 33, nombre: "Sabor no característico", grupo: "calidad" },
  { codigo: "34", nro: 34, nombre: "Color no característico", grupo: "calidad" },
  { codigo: "35", nro: 35, nombre: "Producto descongelado", grupo: "calidad" },
  { codigo: "36", nro: 36, nombre: "Lechosidad", grupo: "calidad" },
  { codigo: "37", nro: 37, nombre: "Deshidratado", grupo: "calidad" },
  { codigo: "38", nro: 38, nombre: "No cumple microbiológicamente", grupo: "calidad" },
  { codigo: "39", nro: 39, nombre: "Mal loteado", grupo: "calidad" },
  { codigo: "40", nro: 40, nombre: "Cliente cancela pedido", grupo: "comercial" },
  { codigo: "MERMA", nro: 41, nombre: "Merma", grupo: "categoria" },
  { codigo: "PRECIO", nro: 42, nombre: "Precio", grupo: "categoria" },
];

const NO_ENTREGA = new Set([
  "1",
  "6",
  "9",
  "10",
  "11",
  "14",
  "20",
  "21",
  "22",
  "23",
  "40",
]);

export const motivoPorCodigo = (codigo) =>
  MOTIVOS_NOVEDAD_RUTA.find((m) => m.codigo === String(codigo || "").toUpperCase()) ||
  MOTIVOS_NOVEDAD_RUTA.find((m) => String(m.nro) === String(codigo || ""));

export const esMotivoNoEntrega = (codigo) => NO_ENTREGA.has(String(codigo || "").toUpperCase());

export const esEntregaCompleta = (codigo) =>
  String(codigo || "").toUpperCase() === MOTIVO_ENTREGA_COMPLETA;

export const etiquetaMotivo = (codigo) => {
  const m = motivoPorCodigo(codigo);
  if (!m) return "";
  if (!m.nro) return m.nombre;
  if (m.grupo === "categoria") return m.nombre.toUpperCase();
  return `${m.nro}. ${m.nombre}`;
};
