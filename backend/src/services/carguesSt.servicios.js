import { normalizarCodigoBodega } from "../data/bodegasGrupoEtc";
import { esCanastaInventario, esCanastillaInventario } from "./siesaExistencias.servicios";
import {
  consultarDocumentosStSiesa,
  resumenSt,
} from "./siesaSt.servicios";

const txt = (valor) => String(valor ?? "").trim();

const num = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const n = Number(String(valor).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const idEncSt = (consec) => {
  const n = txt(consec);
  if (!n) return "";
  return `ST-${n}`;
};

export const claveConsecSt = (idEnc) => {
  const k = txt(idEnc);
  if (!k) return "";
  return k.replace(/^ST-/i, "");
};

const mismaBodegaSal = (codigoSalida, bodegaCargue) =>
  normalizarCodigoBodega(codigoSalida) === normalizarCodigoBodega(bodegaCargue);

export const agruparFilasStPorDocumento = (filas = []) => {
  const map = new Map();
  for (const row of filas) {
    const consec = txt(row.consec_docto);
    if (!consec) continue;
    if (!map.has(consec)) {
      map.set(consec, {
        consec_docto: consec,
        tipo_docto: txt(row.tipo_docto) || "ST",
        fecha: txt(row.fecha),
        notas: txt(row.notas),
        codigo_bodega_sal: txt(row.codigo_bodega_sal),
        bodega_sal: txt(row.bodega_sal),
        codigo_bodega_ent: txt(row.codigo_bodega_ent),
        bodega_ent: txt(row.bodega_ent),
        filas: [],
      });
    }
    map.get(consec).filas.push(row);
  }
  return map;
};

export const snapshotStDesdeGrupo = (grupo) => {
  const lineas = [];
  let peso = 0;
  let unidades = 0;
  for (const row of grupo.filas || []) {
    const s1 = num(row.cant_saldo_1);
    const s2 = num(row.cant_saldo_2);
    if (s1 <= 0 && s2 <= 0) continue;
    if (!esCanastaInventario(row) && !esCanastillaInventario(row)) {
      peso += s1;
      unidades += s2;
    }
    lineas.push({
      codigo: txt(row.referencia_item),
      referencia: txt(row.referencia_item),
      producto: txt(row.descripcion_item),
      descripcion: txt(row.descripcion_item),
      kilo: s1,
      pesoPedido: s1,
      cant1: s2,
      cant2: s1,
      unidades: s2,
      estadoFrio: txt(row.estado_frio),
    });
  }
  const consec = txt(grupo.consec_docto);
  const destino = txt(grupo.bodega_ent) || txt(grupo.codigo_bodega_ent);
  const observacion = [txt(grupo.notas), destino ? `Destino: ${destino}` : ""]
    .filter(Boolean)
    .join(" · ");
  return {
    tipo: "TRANSITO",
    tipoDoc: "ST",
    idEnc: idEncSt(consec),
    nroDoc: consec,
    tipoDocto: "ST",
    nit: "",
    codigoCliente: "",
    codigo: txt(grupo.codigo_bodega_ent),
    observacion,
    fecha: txt(grupo.fecha),
    sucursal: destino,
    municipio: "",
    barrio: "",
    cndPago: "",
    direccion: "",
    vendedor: "",
    contacto: "",
    telefono: "",
    valor: 0,
    peso: Number(peso.toFixed(2)),
    unidades: Number(unidades.toFixed(2)),
    cliente: destino || "Tránsito",
    establecimiento: destino,
    hora: "",
    bodega: txt(grupo.codigo_bodega_sal),
    estado: "Aprobado",
    lineas,
  };
};

export const esperaStCargueMs = () =>
  Number(process.env.SIESA_ST_ESPERA_CARGUE_MS || process.env.SIESA_ST_ESPERA_MS || 180000);

export const listarStAbiertasParaCargue = async (bodegaCargue, ocupados = new Set()) => {
  const espera = esperaStCargueMs();
  let filas = [];
  try {
    filas = await consultarDocumentosStSiesa(espera);
  } catch (error) {
    console.error("[cargue-st]", error.message);
    filas = resumenSt().filas || [];
  }
  if (!Array.isArray(filas)) filas = [];

  const grupos = agruparFilasStPorDocumento(filas);
  const body = [];
  for (const grupo of grupos.values()) {
    if (!mismaBodegaSal(grupo.codigo_bodega_sal, bodegaCargue)) continue;
    const snap = snapshotStDesdeGrupo(grupo);
    if (!snap.idEnc || !snap.lineas.length) continue;
    if (ocupados.has(snap.idEnc) || ocupados.has(snap.nroDoc)) continue;
    body.push(snap);
  }
  body.sort((a, b) => String(b.nroDoc).localeCompare(String(a.nroDoc)));
  return {
    items: body,
    meta: {
      enCurso: Boolean(resumenSt().enCurso),
      totalFilasSt: filas.length,
    },
  };
};

export const snapshotsStPorIds = async (ids, bodegaCargue) => {
  const lista = Array.isArray(ids) ? ids.map(String) : [];
  const consecBuscados = new Set(
    lista.flatMap((id) => {
      const c = claveConsecSt(id);
      return c ? [c, idEncSt(c)] : [id];
    })
  );
  const { items } = await listarStAbiertasParaCargue(bodegaCargue, new Set());
  const porId = new Map();
  for (const item of items) {
    porId.set(item.idEnc, item);
    porId.set(item.nroDoc, item);
  }
  const out = [];
  for (const id of lista) {
    const snap = porId.get(id) || porId.get(claveConsecSt(id));
    if (snap) out.push(snap);
  }
  return out;
};
