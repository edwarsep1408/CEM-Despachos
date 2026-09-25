const txt = (value: unknown) => String(value ?? "").trim();

const esTipoPedidoSiesa = (tipo: string) => {
  const t = tipo.toUpperCase();
  return t.startsWith("PV") || t === "RA" || t === "ST" || t === "OC";
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
  const nro = String(row.idEnc || row.nroDoc || row.pedidoIdEnc || row.NumPedido || "").trim();
  const tipoSiesa = row.tipoDocto || row.tipoDocPedido || row.tipo_docto || "";
  // OC madre#PDV → "OC 0020106507 · 262-EXITO…"
  if (nro.includes("#") && String(tipoSiesa || row.tipo || "").toUpperCase().includes("OC")) {
    const [madre, gln] = nro.split("#");
    const nroOc = madre.replace(/^OC-?/i, "");
    const pdv =
      row.cliente ||
      row.nombreEstablecimiento ||
      row.codigoDep ||
      row.codigoEstablecimiento ||
      gln;
    return `OC ${nroOc} · ${pdv}`;
  }
  return etiquetaDocto(tipoSiesa, nro) || txt(nro);
}
