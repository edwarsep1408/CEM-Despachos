const txt = (value: unknown) => String(value ?? "").trim();

const esTipoPedidoSiesa = (tipo: string) => {
  const t = tipo.toUpperCase();
  return t.startsWith("PV") || t === "RA";
};

export function etiquetaDocto(tipo?: unknown, nro?: unknown): string {
  const t = txt(tipo);
  const n = txt(nro);
  if (!t || !esTipoPedidoSiesa(t)) return n || t;
  if (!n) return t;
  const nUp = n.toUpperCase();
  const tUp = t.toUpperCase();
  if (nUp === tUp || nUp.startsWith(`${tUp} `) || nUp.startsWith(`${tUp}-`)) return n;
  return `${t} ${n}`;
}

export function etiquetaPedido(row: any = {}): string {
  const nro = row.idEnc || row.nroDoc || row.pedidoIdEnc || row.NumPedido || "";
  const tipoSiesa = row.tipoDocto || row.tipoDocPedido || row.tipo_docto || "";
  return etiquetaDocto(tipoSiesa, nro) || txt(nro);
}
