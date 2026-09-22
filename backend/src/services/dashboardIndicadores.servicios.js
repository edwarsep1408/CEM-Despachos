import { consultarExistenciasCompania, esStInventarioCompania, kgInventarioFila, unidadesInventarioFila, totalKgEtc, totalUnidadesEtc, cantidadCanastaFila, esCanastillaInventario } from "./siesaExistencias.servicios";
import { GRUPOS_CEDI, GRUPO_EXTERNAS } from "../data/capacidadBodegas";
import { consultarDocumentosStSiesa, kpisTransito, resumenSt } from "./siesaSt.servicios";
import { CATALOGO_BODEGAS_ETC, normalizarCodigoBodega } from "../data/bodegasGrupoEtc";

const txt = (valor) => String(valor ?? "").trim();
const num = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
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
const redondearKg = (valor) => Number(num(valor).toFixed(2));

export const armarIndicadoresInventario = async () => {
  const filas = await consultarExistenciasCompania();
  const porCodigo = mapaCodigoGrupo();
  const kgPorGrupo = { externas: 0 };
  const kgPorBodega = new Map();
  const undPorBodega = new Map();
  for (const grupo of GRUPOS_CEDI) kgPorGrupo[grupo.id] = 0;

  const porTipo = { pollo_pt: 0, pollo_proceso: 0, carnes_frias: 0 };
  const porProducto = new Map();
  const canastasPorBodega = new Map();
  const canastillasPorBodega = new Map();
  let canastasTotales = 0;
  let canastillasTotales = 0;

  for (const row of filas) {
    const cantCanasta = cantidadCanastaFila(row);
    if (cantCanasta > 0) {
      const claveCanasta = normalizarCodigoBodega(row.codigo_bodega);
      if (esCanastillaInventario(row)) {
        canastillasPorBodega.set(claveCanasta, (canastillasPorBodega.get(claveCanasta) || 0) + cantCanasta);
        canastillasTotales += cantCanasta;
      } else {
        canastasPorBodega.set(claveCanasta, (canastasPorBodega.get(claveCanasta) || 0) + cantCanasta);
        canastasTotales += cantCanasta;
      }
    }
    const kg = kgInventarioFila(row);
    const und = unidadesInventarioFila(row);
    if (und > 0) {
      const claveUnd = normalizarCodigoBodega(row.codigo_bodega);
      undPorBodega.set(claveUnd, (undPorBodega.get(claveUnd) || 0) + und);
    }
    if (!(kg > 0)) continue;
    const bodega = txt(row.codigo_bodega).toUpperCase();
    const grupoId = porCodigo.get(bodega) || GRUPO_EXTERNAS.id;
    kgPorGrupo[grupoId] = (kgPorGrupo[grupoId] || 0) + kg;
    const claveBodega = normalizarCodigoBodega(bodega);
    kgPorBodega.set(claveBodega, (kgPorBodega.get(claveBodega) || 0) + kg);
    const tipo = clasificarTipo(row);
    porTipo[tipo] += kg;

    const ref = txt(row.referencia) || txt(row.descripcion);
    if (!ref) continue;
    if (!porProducto.has(ref)) {
      porProducto.set(ref, {
        referencia: ref,
        descripcion: txt(row.descripcion) || ref,
        tipo,
        grupos: { prado: 0, norte: 0, uraba: 0, suroeste: 0, monteria: 0, externas: 0 },
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
      kg: redondearKg(kg),
      porcentaje: Number(porcentaje.toFixed(0)),
    };
  });
  const kgExternas = kgPorGrupo.externas || 0;
  ocupacion.push({
    id: GRUPO_EXTERNAS.id,
    etiqueta: GRUPO_EXTERNAS.etiqueta,
    capacidad: GRUPO_EXTERNAS.capacidad,
    kg: redondearKg(kgExternas),
    porcentaje: 0,
  });
  const kgCedis = GRUPOS_CEDI.reduce((acc, grupo) => acc + (kgPorGrupo[grupo.id] || 0), 0);
  const kgTotales = totalKgEtc(filas);
  ocupacion.push({
    id: "total",
    etiqueta: "TOTAL ETC",
    capacidad: 0,
    kg: redondearKg(kgTotales),
    porcentaje: 0,
  });

  const bodegasEtc = CATALOGO_BODEGAS_ETC.map((item) => {
    const clave = normalizarCodigoBodega(item.codigo);
    return {
      codigo: item.codigo,
      descripcion: item.descripcion,
      kg: redondearKg(kgPorBodega.get(clave) || 0),
      unidades: redondear(undPorBodega.get(clave) || 0),
      canastas: redondear(canastasPorBodega.get(clave) || 0),
      canastillas: redondear(canastillasPorBodega.get(clave) || 0),
    };
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
      kg: redondearKg(porTipo.pollo_pt),
      porcentaje: pct(porTipo.pollo_pt),
    },
    {
      id: "pollo_proceso",
      etiqueta: "POLLO PRODUCTO EN PROCESO",
      kg: redondearKg(porTipo.pollo_proceso),
      porcentaje: pct(porTipo.pollo_proceso),
    },
    {
      id: "carnes_frias",
      etiqueta: "CARNES FRIAS PRODUCTO TERMINADO",
      kg: redondearKg(porTipo.carnes_frias),
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
      externa: redondearKg(item.grupos.externas),
      norte: redondearKg(item.grupos.norte),
      suroeste: redondearKg(item.grupos.suroeste),
      uraba: redondearKg(item.grupos.uraba),
      prado: redondearKg(item.grupos.prado),
      monteria: redondearKg(item.grupos.monteria),
      total: redondearKg(item.total),
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

  const todasSt = await consultarDocumentosStSiesa(0);
  const filasSt = todasSt.filter((row) => esStInventarioCompania(row));
  const estadoSt = resumenSt();
  const mov = kpisTransito(filasSt);
  const kgBodega = redondearKg(kgTotales);
  const kgTransito = redondearKg(mov.totalKgMovimiento);
  const unidadesBodega = redondear(totalUnidadesEtc(filas));
  const unidadesTransito = redondear(mov.totalUnidadesMovimiento);

  return {
    corte: ahora.toISOString(),
    corteTexto,
    mes: meses[ahora.getMonth()],
    anio: ahora.getFullYear(),
    kgTotales: kgBodega,
    kgBodega,
    kgTransito,
    kgConTransito: redondearKg(kgBodega + kgTransito),
    unidadesBodega,
    unidadesTransito,
    unidadesConTransito: redondear(unidadesBodega + unidadesTransito),
    kgPollo: redondearKg(kgPollo),
    kgCarnesFrias: redondearKg(kgCarnes),
    canastas: redondear(canastasTotales),
    canastillas: redondear(canastillasTotales),
    transito: {
      listo: estadoSt.listo,
      enCurso: estadoSt.enCurso,
      filas: todasSt.length,
    },
    ocupacion,
    bodegasEtc,
    participacion,
    top10,
  };
};

export default { armarIndicadoresInventario };
