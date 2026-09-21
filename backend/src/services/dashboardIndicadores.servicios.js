import { consultarExistenciasCompania } from "./siesaExistencias.servicios";
import { GRUPOS_CEDI, GRUPO_EXTERNAS } from "../data/capacidadBodegas";

const txt = (valor) => String(valor ?? "").trim();
const num = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

const esCanasta = (row) => {
  const d = txt(row.descripcion).toUpperCase();
  return d === "CANASTAS" || d === "CANASTILLAS";
};

const clasificarTipo = (row) => {
  const tipo = txt(row.tipo_inventario).toUpperCase();
  const descTipo = txt(row.desc_tipo_inventario).toUpperCase();
  const desc = txt(row.descripcion).toUpperCase();
  const linea = txt(row.descripcion_linea).toUpperCase();
  if (
    tipo.includes("INV143502") ||
    descTipo.includes("CARNE") ||
    descTipo.includes("FRIA") ||
    desc.includes("CARNES FRIA") ||
    desc.includes("CARNE FRIA") ||
    linea.includes("DERIVADOS")
  ) {
    return "carnes_frias";
  }
  if (tipo.includes("INV143501") || desc.includes("PROCESO") || linea.includes("PROCESO")) {
    return "pollo_proceso";
  }
  return "pollo_pt";
};

const mapaCodigoGrupo = () => {
  const mapa = new Map();
  for (const grupo of GRUPOS_CEDI) {
    for (const codigo of grupo.codigos) {
      mapa.set(codigo.toUpperCase(), grupo.id);
    }
  }
  return mapa;
};

const redondear = (valor) => Number(num(valor).toFixed(0));

export const armarIndicadoresInventario = async () => {
  const filas = (await consultarExistenciasCompania()).filter((row) => !esCanasta(row));
  const porCodigo = mapaCodigoGrupo();
  const kgPorGrupo = { externas: 0 };
  for (const grupo of GRUPOS_CEDI) kgPorGrupo[grupo.id] = 0;

  const porTipo = { pollo_pt: 0, pollo_proceso: 0, carnes_frias: 0 };
  const porProducto = new Map();

  for (const row of filas) {
    const kg = num(row.Existencia_1);
    if (!(kg > 0)) continue;
    const bodega = txt(row.codigo_bodega).toUpperCase();
    const grupoId = porCodigo.get(bodega) || GRUPO_EXTERNAS.id;
    kgPorGrupo[grupoId] = (kgPorGrupo[grupoId] || 0) + kg;
    const tipo = clasificarTipo(row);
    porTipo[tipo] += kg;

    const ref = txt(row.referencia) || txt(row.descripcion);
    if (!ref) continue;
    if (!porProducto.has(ref)) {
      porProducto.set(ref, {
        referencia: ref,
        descripcion: txt(row.descripcion) || ref,
        tipo,
        grupos: { prado: 0, norte: 0, uraba: 0, suroeste: 0, externas: 0 },
        total: 0,
      });
    }
    const item = porProducto.get(ref);
    item.grupos[grupoId] = (item.grupos[grupoId] || 0) + kg;
    item.total += kg;
  }

  const ocupacion = GRUPOS_CEDI.map((grupo) => {
    const kg = kgPorGrupo[grupo.id] || 0;
    const porcentaje = grupo.capacidad > 0 ? (kg / grupo.capacidad) * 100 : 0;
    return {
      id: grupo.id,
      etiqueta: grupo.etiqueta,
      capacidad: grupo.capacidad,
      kg: redondear(kg),
      porcentaje: Number(porcentaje.toFixed(0)),
    };
  });
  const kgExternas = kgPorGrupo.externas || 0;
  ocupacion.push({
    id: GRUPO_EXTERNAS.id,
    etiqueta: GRUPO_EXTERNAS.etiqueta,
    capacidad: GRUPO_EXTERNAS.capacidad,
    kg: redondear(kgExternas),
    porcentaje: 0,
  });
  const capacidadTotal = GRUPOS_CEDI.reduce((acc, grupo) => acc + grupo.capacidad, 0);
  const kgCedis = GRUPOS_CEDI.reduce((acc, grupo) => acc + (kgPorGrupo[grupo.id] || 0), 0);
  const kgTotales = kgCedis + kgExternas;
  ocupacion.push({
    id: "total",
    etiqueta: "TOTAL",
    capacidad: capacidadTotal,
    kg: redondear(kgTotales),
    porcentaje: capacidadTotal > 0 ? Number(((kgTotales / capacidadTotal) * 100).toFixed(0)) : 0,
  });

  const kgPollo = porTipo.pollo_pt + porTipo.pollo_proceso;
  const kgCarnes = porTipo.carnes_frias;
  const kgParticipacion = kgPollo + kgCarnes;
  const pct = (kg) =>
    kgParticipacion > 0 ? Number(((kg / kgParticipacion) * 100).toFixed(0)) : 0;
  const participacion = [
    {
      id: "pollo_pt",
      etiqueta: "POLLO PRODUCTO TERMINADO",
      kg: redondear(porTipo.pollo_pt),
      porcentaje: pct(porTipo.pollo_pt),
    },
    {
      id: "pollo_proceso",
      etiqueta: "POLLO PRODUCTO EN PROCESO",
      kg: redondear(porTipo.pollo_proceso),
      porcentaje: pct(porTipo.pollo_proceso),
    },
    {
      id: "carnes_frias",
      etiqueta: "CARNES FRIAS PRODUCTO TERMINADO",
      kg: redondear(porTipo.carnes_frias),
      porcentaje: pct(porTipo.carnes_frias),
    },
  ];

  const top10 = [...porProducto.values()]
    .filter((item) => item.tipo !== "carnes_frias")
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((item) => ({
      referencia: item.referencia,
      descripcion: item.descripcion,
      externa: redondear(item.grupos.externas),
      norte: redondear(item.grupos.norte),
      suroeste: redondear(item.grupos.suroeste),
      uraba: redondear(item.grupos.uraba),
      prado: redondear(item.grupos.prado),
      total: redondear(item.total),
    }));

  const ahora = new Date();
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const dias = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
  ];
  const corteTexto = `${dias[ahora.getDay()]}, ${ahora.getDate()} de ${meses[ahora.getMonth()]} de ${ahora.getFullYear()}`;

  return {
    corte: ahora.toISOString(),
    corteTexto,
    mes: meses[ahora.getMonth()],
    anio: ahora.getFullYear(),
    kgTotales: redondear(kgTotales),
    kgPollo: redondear(kgPollo),
    kgCarnesFrias: redondear(kgCarnes),
    ocupacion,
    participacion,
    top10,
  };
};

export default { armarIndicadoresInventario };
