/** Capacidades de almacenamiento (kg) usadas en Indicadores de inventario. */
export const GRUPOS_CEDI = [
  { id: "prado", etiqueta: "PRADO", columna: "Prado", codigos: ["PT001"], capacidad: 225000 },
  { id: "norte", etiqueta: "CEDI NORTE", columna: "Cedi Norte", codigos: ["PT002"], capacidad: 70000 },
  { id: "uraba", etiqueta: "CEDI URABA", columna: "Cedi Uraba", codigos: ["PT003"], capacidad: 17000 },
  { id: "suroeste", etiqueta: "CEDI SUROESTE", columna: "Cedi Suroeste", codigos: ["PT004"], capacidad: 80000 },
  { id: "monteria", etiqueta: "CEDI MONTERIA", columna: "Cedi Monteria", codigos: ["PT007"], capacidad: 0 },
];

export const GRUPO_EXTERNAS = {
  id: "externas",
  etiqueta: "OTRAS ETC",
  columna: "Bod. Externa",
  capacidad: 0,
};

export const CODIGOS_CEDI = GRUPOS_CEDI.flatMap((grupo) => grupo.codigos);

export default { GRUPOS_CEDI, GRUPO_EXTERNAS, CODIGOS_CEDI };
