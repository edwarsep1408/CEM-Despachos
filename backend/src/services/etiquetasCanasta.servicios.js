const txt = (valor) => String(valor ?? "").trim();

export const tipoCodigoDe = (doc = {}) => {
  const crudo = txt(doc.tipoDocto || doc.tipo_docto).replace(/\s+/g, "").toUpperCase();
  if (crudo) return crudo;
  const tipo = txt(doc.tipoDoc || doc.tipo).replace(/\s+/g, "").toUpperCase();
  if (/^PV[A-Z]/.test(tipo) || tipo === "RA") return tipo;
  return tipo || "PEDIDO";
};

export const documentoBaseDe = (doc = {}) => {
  const tipo = tipoCodigoDe(doc);
  let nro = txt(doc.nroDoc || doc.idEnc).replace(/\s+/g, "").toUpperCase();
  if (nro.startsWith(tipo)) nro = nro.slice(tipo.length).replace(/^[-_]/, "");
  return `${tipo}${nro}`;
};

export const codigoCanastaDe = (doc, canastaNum) => {
  const n = Math.max(1, Math.floor(Number(canastaNum) || 1));
  return `${documentoBaseDe(doc)}-C${String(n).padStart(2, "0")}`;
};

export const parsearCodigoCanasta = (codigo) => {
  const s = txt(codigo).toUpperCase();
  const m = s.match(/^(.*)-C(\d+)$/);
  if (!m) return null;
  return { documentoRef: m[1], canastaNum: Number(m[2]), codigo: s };
};

export const armarEtiquetasCanasta = (doc, totalCanastas) => {
  const total = Math.max(0, Math.floor(Number(totalCanastas) || 0));
  if (!total) return [];
  const ahora = new Date();
  return Array.from({ length: total }, (_, i) => {
    const canastaNum = i + 1;
    return {
      codigo: codigoCanastaDe(doc, canastaNum),
      canastaNum,
      totalCanastas: total,
      fecha: ahora,
    };
  });
};
