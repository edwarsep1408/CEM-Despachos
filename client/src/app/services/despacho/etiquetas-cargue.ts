import { firstValueFrom, Observable } from "rxjs";
import Swal from "sweetalert2";
import { abrirVentanaImpresion, llenarImpresion } from "./hoja-impresion";
import { qrSvg } from "./qr-svg";
import { cargarBitmapHija, cargarBitmapPadre, descargarPrn, tsplBanderinHija, tsplBanderinPadre } from "./etiquetas-tspl";

export type EtiquetaCanasta = {
  cliente: string;
  sucursal: string;
  nit: string;
  municipio: string;
  documentoRef: string;
  tipoDoc: string;
  nroDoc: string;
  canastaNum: number;
  totalCanastas: number;
  codigo: string;
  qr: string;
  loadName: string;
  stateProduct: string;
  /** Producto de la línea pesada (etiqueta estilo Éxito). */
  producto: string;
  plu: string;
  pesoKg: string;
  codigoDep: string;
  dependencia: string;
  zona: string;
  cadena: string;
  /** Layout banderín Éxito (DEP grande). */
  estiloExito: boolean;
};

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const txt = (value: unknown) => String(value ?? "").trim();

export const tipoCodigoDe = (doc: any = {}) => {
  const crudo = txt(doc.tipoDocto || doc.tipo_docto).replace(/\s+/g, "").toUpperCase();
  if (crudo) return crudo;
  const tipo = txt(doc.tipoDoc || doc.tipo).replace(/\s+/g, "").toUpperCase();
  if (/^PV[A-Z]/.test(tipo) || tipo === "RA") return tipo;
  return tipo || "PEDIDO";
};

export const documentoRefDe = (doc: any = {}) => {
  const tipo = tipoCodigoDe(doc);
  let nro = txt(doc.nroDoc || doc.idEnc).replace(/\s+/g, "").toUpperCase();
  if (nro.startsWith(tipo)) nro = nro.slice(tipo.length).replace(/^[-_]/, "");
  return `${tipo}${nro}`;
};

export const codigoCanastaDe = (doc: any, canastaNum: number) => {
  const n = Math.max(1, Math.floor(Number(canastaNum) || 1));
  return `${documentoRefDe(doc)}-C${String(n).padStart(2, "0")}`;
};

export const parsearCodigoCanasta = (codigo: unknown) => {
  const s = txt(codigo).toUpperCase();
  const m = s.match(/^(.*)-C(\d+)$/);
  if (!m) return null;
  return { documentoRef: m[1], canastaNum: Number(m[2]), codigo: s };
};

export const clienteDeDoc = (doc: any = {}) =>
  txt(doc.cliente || doc.establecimiento || doc.contacto || doc.sucursal);

export const sucursalDeDoc = (doc: any = {}) => {
  const cliente = clienteDeDoc(doc).toUpperCase();
  const sucursal = txt(doc.sucursal || doc.establecimiento || doc.contacto);
  if (!sucursal) return "";
  if (sucursal.toUpperCase() === cliente) return "";
  return sucursal;
};

export const estadoFrioDeDoc = (doc: any = {}) => {
  const lineas = Array.isArray(doc.lineas) ? doc.lineas : [];
  for (const linea of lineas) {
    const crudo = txt(linea.estadoFrio || linea.estado_frio).toUpperCase();
    if (!crudo) continue;
    if (crudo.startsWith("CONG")) return "CON";
    if (crudo.startsWith("REF")) return "REF";
    return crudo.slice(0, 12);
  }
  return txt(doc.estadoFrio || doc.conservar);
};

export const loadNameDeDoc = (doc: any = {}) => {
  const id = txt(doc.idCargue || doc.nroCargue);
  if (id) return `Cargue ${id}`;
  return txt(doc.loadName || doc.placa);
};

const productoDeLinea = (linea: any = {}) =>
  txt(linea.producto || linea.descripcion || linea.nombre || linea.item);

const pluDeLinea = (linea: any = {}) =>
  txt(linea.plu || linea.codigoComprador || linea.codigo || linea.referencia || linea.ean);

/** Formatea peso neto para etiqueta Éxito, ej. "12.45 Kg". */
export const pesoKgDe = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toFixed(2)} Kg`;
};

const pesoKgDeLinea = (linea: any = {}) => {
  const pesajes = Array.isArray(linea?.pesajes) ? linea.pesajes : [];
  const ultimo = pesajes[pesajes.length - 1];
  return pesoKgDe(ultimo?.pNeto ?? ultimo?.peso ?? linea?.pd ?? linea?.kilo);
};

/** Producto/PLU: línea actual del pesaje, o la primera con pesaje, o la primera del doc. */
export const productoPluDeDoc = (doc: any = {}, linea?: any) => {
  if (linea && (productoDeLinea(linea) || pluDeLinea(linea))) {
    return {
      producto: productoDeLinea(linea),
      plu: pluDeLinea(linea),
      pesoKg: pesoKgDeLinea(linea),
    };
  }
  const lineas = Array.isArray(doc.lineas) ? doc.lineas : [];
  const conPesaje = lineas.find((l: any) => Array.isArray(l?.pesajes) && l.pesajes.length);
  const elegida = conPesaje || lineas[0] || {};
  return {
    producto: productoDeLinea(elegida),
    plu: pluDeLinea(elegida),
    pesoKg: pesoKgDeLinea(elegida),
  };
};

export const localizacionDeDoc = (doc: any = {}) => {
  const codigoDep = txt(
    doc.codigoDep || doc.codigoEstablecimiento || doc.codigoCliente || doc.codigo
  );
  const dependencia = txt(
    doc.dependencia ||
      doc.nombreEstablecimiento ||
      doc.establecimiento ||
      doc.sucursal ||
      doc.cliente
  );
  const zona = txt(doc.zona);
  const cadena = txt(doc.cadena || doc.razonSocial);
  return { codigoDep, dependencia, zona, cadena };
};

/** Solo Almacenes Éxito / Éxito Express (no Carulla ni otros). */
export const esClienteExito = (doc: any = {}, loc: { cadena?: string; dependencia?: string } = {}) => {
  const blob = [
    loc.cadena,
    doc.cadena,
    doc.razonSocial,
    loc.dependencia,
    doc.dependencia,
    doc.establecimiento,
    doc.sucursal,
    doc.cliente,
  ]
    .map((v) => txt(v).toUpperCase())
    .join(" | ");
  if (!blob.trim()) return false;
  if (/CARULLA|SURTIMAX|SUPER\s*INTER/.test(blob)) return false;
  return /ALMACENES\s+EXITO|EXITO\s+EXPRESS|\bEXITO\b/.test(blob);
};

/** Canastas declaradas en un taraDetalle de un pesaje. */
export const contarCanastasEnDetalle = (taraDetalle: unknown) => {
  const det = taraDetalle && typeof taraDetalle === "object" ? (taraDetalle as Record<string, number>) : {};
  let n = 0;
  for (const nombre of Object.keys(det)) {
    if (!/CANAST/i.test(nombre)) continue;
    n += Number(det[nombre]) || 0;
  }
  return n;
};

export const contarCanastas = (doc: any = {}) => {
  let n = 0;
  for (const linea of doc.lineas || []) {
    for (const p of linea.pesajes || []) {
      n += contarCanastasEnDetalle(p?.taraDetalle);
    }
  }
  return n;
};

/** Documento cerrado / listo (todas las líneas despachadas u omitidas). */
export const documentoListoParaEtiquetas = (doc: any = {}) => {
  if (doc.omitido || txt(doc.estadoDespacho) === "OMIT") return false;
  if (txt(doc.estadoDespacho) === "DESP") return true;
  const lineas = Array.isArray(doc.lineas) ? doc.lineas : [];
  if (!lineas.length) return false;
  return lineas.every(
    (linea: any) =>
      linea.omitido ||
      txt(linea.estadoDespacho) === "DESP" ||
      txt(linea.estadoDespacho) === "OMIT"
  );
};

/** Se puede etiquetar en cualquier momento del despacho (sin terminar). */
export const documentoPuedeEtiquetas = (doc: any = {}) => {
  if (!doc || doc.omitido || txt(doc.estadoDespacho) === "OMIT") return false;
  return true;
};

export const armarEtiquetasCanasta = (
  doc: any = {},
  totalCanastas: number,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = [],
  opts: { linea?: any } = {}
): EtiquetaCanasta[] => {
  const total = Math.max(0, Math.floor(Number(totalCanastas) || 0));
  if (!total) return [];
  const cliente = clienteDeDoc(doc);
  const sucursal = sucursalDeDoc(doc);
  const nit = txt(doc.nit);
  const municipio = txt(doc.municipio);
  const tipoDoc = txt(doc.tipoDoc || doc.tipo || "PEDIDO");
  const nroDoc = txt(doc.nroDoc || doc.idEnc);
  const documentoRef = documentoRefDe(doc);
  const loadName = loadNameDeDoc(doc);
  const stateProduct = estadoFrioDeDoc(doc);
  const { producto, plu, pesoKg } = productoPluDeDoc(doc, opts.linea);
  const { codigoDep, dependencia, zona, cadena } = localizacionDeDoc(doc);
  const estiloExito = esClienteExito(doc, { cadena, dependencia });
  const porNum = new Map(
    (registradas || [])
      .filter((e) => e?.codigo && e?.canastaNum)
      .map((e) => [Number(e.canastaNum), txt(e.codigo).toUpperCase()])
  );
  const usados = new Set<string>();
  return Array.from({ length: total }, (_, i) => {
    const canastaNum = i + 1;
    const codigo = porNum.get(canastaNum) || codigoCanastaDe(doc, canastaNum);
    if (usados.has(codigo)) {
      throw new Error(`El código ${codigo} quedó repetido.`);
    }
    usados.add(codigo);
    return {
      cliente,
      sucursal,
      nit,
      municipio,
      documentoRef,
      tipoDoc,
      nroDoc,
      canastaNum,
      totalCanastas: total,
      codigo,
      qr: codigo,
      loadName,
      stateProduct,
      producto: producto || cliente || "SIN PRODUCTO",
      plu,
      pesoKg: pesoKg || "",
      codigoDep,
      dependencia: dependencia || cliente,
      zona,
      cadena,
      estiloExito,
    };
  });
};

const cssEtiquetas = `
  @page{size:304mm 60mm;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff}
  body{font-family:Arial,Helvetica,sans-serif;color:#111}
  .etiq{
    width:304mm;height:60mm;page-break-after:always;
    display:flex;flex-direction:row;align-items:center;
    padding:3mm 5mm 3mm 8mm;gap:5mm;overflow:hidden;
  }
  .etiq:last-child{page-break-after:auto}
  .etiq--exito{align-items:stretch;padding:2.5mm 4mm 2.5mm 10mm;gap:4mm}
  .bloque{
    position:relative;flex:1;min-width:0;height:100%;
    display:flex;flex-direction:column;justify-content:center;
    padding-left:7mm;
  }
  .lado{
    position:absolute;left:0;top:0;bottom:0;width:6mm;
    display:flex;align-items:center;justify-content:center;
  }
  .lado span{
    transform:rotate(-90deg);white-space:nowrap;
    font-size:8px;font-weight:700;letter-spacing:.04em;
    max-width:52mm;overflow:hidden;text-overflow:ellipsis;
  }
  .titulo{
    font-size:22px;font-weight:800;line-height:1.05;text-transform:uppercase;
    letter-spacing:.01em;
  }
  .datos{margin-top:2mm;font-size:11px;font-weight:700;line-height:1.3}
  .qr{width:36mm;height:36mm;flex:0 0 36mm}
  .qr svg{width:100%;height:100%;display:block}
  .logo{
    flex:0 0 22mm;width:22mm;height:48mm;
    display:flex;align-items:center;justify-content:center;
  }
  .logo img{height:42mm;width:auto;display:block}
  .logo-fallo{
    display:none;width:48mm;height:22mm;background:#111;color:#fff;border-radius:50%;
    align-items:center;justify-content:center;font-size:13px;font-weight:800;
    letter-spacing:.04em;font-style:italic;transform:rotate(90deg);
  }
  .izq{
    flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;
    gap:1.2mm;
  }
  .producto{
    font-size:20px;font-weight:800;line-height:1.05;text-transform:uppercase;
    letter-spacing:.01em;
  }
  .plu{font-size:12px;font-weight:700}
  .logo-row{display:flex;align-items:center;gap:3mm;margin:1mm 0}
  .logo-row img{height:14mm;width:auto;display:block}
  .logo-row .logo-fallo{transform:none;width:28mm;height:12mm;font-size:11px}
  .tienda{font-size:12px;font-weight:700;line-height:1.15;text-transform:uppercase}
  .zona{font-size:11px;font-weight:600}
  .der{
    flex:0 0 78mm;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:2mm;
  }
  .dep{font-size:26px;font-weight:900;line-height:1;letter-spacing:.02em}
  .etiq--exito .qr{width:48mm;height:48mm;flex:none}
`;

const logoPollocoa = () =>
  `${typeof location !== "undefined" ? location.origin : ""}/assets/pollocoa-banderin.png`;

const htmlEtiquetaExito = (e: EtiquetaCanasta) => `<section class="etiq etiq--exito">
  <div class="izq">
    <div class="producto">${esc(e.producto || e.cliente || "SIN PRODUCTO")}</div>
    <div class="plu">${e.plu ? `PLU: ${esc(e.plu)}` : ""}</div>
    <div class="plu">${e.pesoKg ? esc(e.pesoKg) : ""}</div>
    <div class="logo-row">
      <img src="${esc(logoPollocoa())}" alt="pollocoa" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
      <div class="logo-fallo">pollocoa</div>
    </div>
    <div class="tienda">${esc(e.dependencia || e.cliente || "")}</div>
    <div class="zona">${esc(e.zona || "")}</div>
  </div>
  <div class="der">
    <div class="dep">DEP: ${esc(e.codigoDep || "")}</div>
    <div class="qr">${qrSvg(e.codigo)}</div>
  </div>
</section>`;

const htmlEtiquetaGeneral = (e: EtiquetaCanasta) => `<section class="etiq">
  <div class="bloque">
    <div class="lado"><span>${esc(e.cliente || "SIN CLIENTE")}</span></div>
    <div class="titulo">${esc(e.cliente || "SIN CLIENTE")}</div>
    <div class="datos">
      Referencia: ${esc(e.documentoRef)}<br/>
      ${esc(e.loadName)}<br/>
      ${esc(e.stateProduct)}<br/>
      ${esc(e.codigo)}
    </div>
  </div>
  <div class="qr">${qrSvg(e.codigo)}</div>
  <div class="logo">
    <img src="${esc(logoPollocoa())}" alt="pollocoa" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
    <div class="logo-fallo">pollocoa</div>
  </div>
</section>`;

const htmlEtiqueta = (e: EtiquetaCanasta) =>
  e.estiloExito ? htmlEtiquetaExito(e) : htmlEtiquetaGeneral(e);

export const imprimirEtiquetasCanasta = (
  doc: any,
  totalCanastas: number,
  ventana: Window | null = null,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = [],
  opts: {
    enviarTspl?: (tsplBase64: string) => Observable<any>;
    /** Si se indica, solo imprime ese rango (pesaje parcial). */
    desdeCanasta?: number;
    hastaCanasta?: number;
    incluirPadre?: boolean;
    linea?: any;
  } = {}
) => {
  const etiquetas = armarEtiquetasCanasta(doc, totalCanastas, registradas, {
    linea: opts.linea,
  });
  if (!etiquetas.length) return false;
  const desde = Math.max(1, Math.floor(Number(opts.desdeCanasta) || 1));
  const hasta = Math.max(
    desde,
    Math.floor(Number(opts.hastaCanasta) || etiquetas.length)
  );
  const aImprimir = etiquetas.filter(
    (e) => e.canastaNum >= desde && e.canastaNum <= hasta
  );
  if (!aImprimir.length) return false;
  const html = aImprimir.map(htmlEtiqueta).join("");
  const incluirPadre =
    opts.incluirPadre !== false && (opts.desdeCanasta == null || Number(opts.desdeCanasta) <= 1);
  void enviarTsplBanderines(aImprimir, opts.enviarTspl, {
    incluirPadre,
    totalLote: etiquetas.length,
    codigoInicio: etiquetas[0]?.codigo,
    codigoFin: etiquetas[etiquetas.length - 1]?.codigo,
  });
  return llenarImpresion(
    ventana,
    `Etiquetas ${aImprimir[0].documentoRef}`,
    html,
    cssEtiquetas
  );
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

const enviarTsplBanderines = async (
  etiquetas: EtiquetaCanasta[],
  enviarTspl?: (tsplBase64: string) => Observable<any>,
  opts: {
    incluirPadre?: boolean;
    totalLote?: number;
    codigoInicio?: string;
    codigoFin?: string;
  } = {}
) => {
  try {
    const [bitmapHija, bitmapPadre] = await Promise.all([
      cargarBitmapHija(),
      cargarBitmapPadre(),
    ]);
    const primera = etiquetas[0];
    const ultima = etiquetas[etiquetas.length - 1];
    const fecha = new Date().toISOString().slice(0, 10);
    const cliente = primera.cliente || "SIN CLIENTE";
    const jobs: Uint8Array[] = [];

    if (opts.incluirPadre !== false) {
      jobs.push(
        tsplBanderinPadre(
          {
            productLongName: cliente,
            enterpriseClientName: cliente,
            barcodeFather: primera.documentoRef,
            barcodePrintStart: opts.codigoInicio || primera.codigo,
            barcodePrintEnd: opts.codigoFin || ultima.codigo,
            quantity: opts.totalLote || etiquetas.length,
            date: fecha,
          },
          bitmapPadre
        )
      );
    }

    for (const e of etiquetas) {
      jobs.push(
        tsplBanderinHija(
          e.estiloExito
            ? {
                estiloExito: true,
                productLongName: e.producto || e.cliente || "SIN PRODUCTO",
                plu: e.plu,
                pesoKg: e.pesoKg,
                codigoDep: e.codigoDep,
                dependencia: e.dependencia || e.cliente,
                zona: e.zona,
                barcode: e.codigo,
                enterpriseClientName: e.dependencia || e.cliente || "SIN CLIENTE",
              }
            : {
                estiloExito: false,
                productLongName: e.cliente || "SIN CLIENTE",
                referencia: e.documentoRef,
                loadName: e.loadName,
                stateProduct: e.stateProduct,
                consecutive: e.codigo,
                enterpriseClientName: e.cliente || "SIN CLIENTE",
                barcode: e.codigo,
              },
          bitmapHija
        )
      );
    }
    const total = jobs.reduce((n, j) => n + j.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const j of jobs) {
      out.set(j, o);
      o += j.length;
    }
    if (enviarTspl) {
      const res: any = await firstValueFrom(enviarTspl(bytesToBase64(out)));
      const msg = res?.body?.message || "Enviado a la TSC";
      const padreTxt = opts.incluirPadre !== false ? "1 padre + " : "";
      await Swal.fire({
        icon: "success",
        title: msg,
        text: `${padreTxt}${etiquetas.length} hija(s)`,
        timer: 2200,
        showConfirmButton: false,
      });
      return;
    }
    descargarPrn(`${primera.documentoRef}-banderines.prn`, out);
  } catch (err: any) {
    console.error("No se pudo imprimir el TSPL del banderín:", err);
    await Swal.fire({
      icon: "error",
      title: err?.error?.body?.message || err?.message || "No se pudo enviar a la TSC MH241T.",
    });
  }
};

export const abrirImpresionEtiquetas = (
  doc: any,
  totalCanastas: number,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = [],
  opts: {
    enviarTspl?: (tsplBase64: string) => Observable<any>;
    desdeCanasta?: number;
    hastaCanasta?: number;
    incluirPadre?: boolean;
    linea?: any;
  } = {}
) => {
  const ventana = abrirVentanaImpresion("Generando etiquetas…");
  return imprimirEtiquetasCanasta(doc, totalCanastas, ventana, registradas, opts);
};

export const pedirYImprimirEtiquetas = async (
  doc: any,
  opts: {
    cargueId: string;
    registrar: (payload: {
      cargueId: string;
      docId: string;
      totalCanastas?: number;
      nuevasCanastas?: number;
    }) => Observable<any>;
    enviarTspl?: (tsplBase64: string) => Observable<any>;
  }
) => {
  if (!doc || !documentoPuedeEtiquetas(doc)) {
    await Swal.fire({
      icon: "info",
      title: "Este documento no admite etiquetas.",
    });
    return false;
  }
  const canastas = contarCanastas(doc);
  const ya = Array.isArray(doc.etiquetasCanasta) ? doc.etiquetasCanasta.length : 0;
  const sugerido = Math.max(canastas, ya, 1);
  const r = await Swal.fire({
    title: "Etiquetas de canasta",
    text:
      ya > 0
        ? `Ya hay ${ya} registradas. Indique el total (imprime las nuevas; puede seguir pesando).`
        : canastas
          ? `Canastas en pesajes: ${canastas}. Padre + hijas (puede seguir pesando).`
          : "Indique cuántas etiquetas hijas imprimir.",
    input: "number",
    inputValue: sugerido,
    inputAttributes: { min: "1", step: "1" },
    showCancelButton: true,
    confirmButtonText: "Imprimir",
    cancelButtonText: "Cancelar",
  });
  if (!r.isConfirmed) return false;
  const total = Math.floor(Number(r.value) || 0);
  if (total < 1) {
    await Swal.fire({ icon: "info", title: "Indique al menos 1 canasta." });
    return false;
  }
  try {
    const res = await firstValueFrom(
      opts.registrar({
        cargueId: opts.cargueId,
        docId: String(doc._id || doc.idEnc || ""),
        totalCanastas: total,
      })
    );
    const registradas = res?.body?.etiquetas || [];
    const imprimir = res?.body?.etiquetasImprimir || registradas;
    if (res?.body?.documento) {
      Object.assign(doc, res.body.documento);
    }
    const nums = (imprimir as any[]).map((e) => Number(e.canastaNum) || 0).filter(Boolean);
    const desde = nums.length ? Math.min(...nums) : 1;
    const hasta = nums.length ? Math.max(...nums) : total;
    return abrirImpresionEtiquetas(doc, registradas.length || total, registradas, {
      enviarTspl: opts.enviarTspl,
      desdeCanasta: desde,
      hastaCanasta: hasta,
      incluirPadre: Boolean(res?.body?.incluirPadre),
    });
  } catch (err: any) {
    await Swal.fire({
      icon: "error",
      title: err?.error?.body?.message || err?.message || "No se pudieron registrar las etiquetas.",
    });
    return false;
  }
};

/** Tras un pesaje: imprime solo las canastas nuevas de ese pesaje. */
export const imprimirEtiquetasDePesaje = async (
  doc: any,
  nuevasCanastas: number,
  opts: {
    cargueId: string;
    registrar: (payload: {
      cargueId: string;
      docId: string;
      nuevasCanastas: number;
    }) => Observable<any>;
    enviarTspl?: (tsplBase64: string) => Observable<any>;
    linea?: any;
    /** Si false, no pregunta confirmación. */
    confirmar?: boolean;
  }
): Promise<{ ok: boolean; desde: number; hasta: number } | false> => {
  const n = Math.max(0, Math.floor(Number(nuevasCanastas) || 0));
  if (!doc || !documentoPuedeEtiquetas(doc) || n < 1) return false;
  if (opts.confirmar !== false) {
    const r = await Swal.fire({
      title: "Imprimir canastas",
      text: `Este pesaje trae ${n} canasta(s). ¿Imprimir etiqueta(s) ahora?`,
      showCancelButton: true,
      confirmButtonText: "Imprimir",
      cancelButtonText: "Después",
    });
    if (!r.isConfirmed) return false;
  }
  try {
    const res = await firstValueFrom(
      opts.registrar({
        cargueId: opts.cargueId,
        docId: String(doc._id || doc.idEnc || ""),
        nuevasCanastas: n,
      })
    );
    const registradas = res?.body?.etiquetas || [];
    const imprimir = res?.body?.etiquetasImprimir || registradas;
    if (res?.body?.documento) {
      Object.assign(doc, res.body.documento);
    }
    const nums = (imprimir as any[]).map((e) => Number(e.canastaNum) || 0).filter(Boolean);
    const desde = nums.length ? Math.min(...nums) : 1;
    const hasta = nums.length ? Math.max(...nums) : n;
    await abrirImpresionEtiquetas(doc, registradas.length || hasta, registradas, {
      enviarTspl: opts.enviarTspl,
      desdeCanasta: desde,
      hastaCanasta: hasta,
      incluirPadre: Boolean(res?.body?.incluirPadre),
      linea: opts.linea,
    });
    return { ok: true, desde, hasta };
  } catch (err: any) {
    await Swal.fire({
      icon: "error",
      title: err?.error?.body?.message || err?.message || "No se pudieron imprimir las etiquetas.",
    });
    return false;
  }
};

/**
 * Botón por pesaje: imprime (o reimprime) etiquetas de ese pesaje
 * con producto/peso de la línea-pesaje.
 */
export const imprimirEtiquetaDeUnPesaje = async (
  doc: any,
  pesaje: any,
  opts: {
    cargueId: string;
    registrar: (payload: {
      cargueId: string;
      docId: string;
      nuevasCanastas: number;
    }) => Observable<any>;
    enviarTspl?: (tsplBase64: string) => Observable<any>;
    linea?: any;
  }
) => {
  if (!doc || !pesaje || !documentoPuedeEtiquetas(doc)) {
    await Swal.fire({ icon: "info", title: "Este documento no admite etiquetas." });
    return false;
  }
  const n = Math.max(1, contarCanastasEnDetalle(pesaje?.taraDetalle));
  const lineaCtx = opts.linea
    ? { ...opts.linea, pesajes: [pesaje] }
    : { pesajes: [pesaje] };

  const desdePrev = Number(pesaje.etiquetaDesde) || 0;
  const hastaPrev = Number(pesaje.etiquetaHasta) || 0;
  const regs = Array.isArray(doc.etiquetasCanasta) ? doc.etiquetasCanasta : [];
  if (desdePrev >= 1 && hastaPrev >= desdePrev && regs.length >= hastaPrev) {
    const r = await Swal.fire({
      title: "Reimprimir etiquetas",
      text: `${hastaPrev - desdePrev + 1} etiqueta(s) de este pesaje.`,
      showCancelButton: true,
      confirmButtonText: "Imprimir",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return false;
    return abrirImpresionEtiquetas(doc, regs.length, regs, {
      enviarTspl: opts.enviarTspl,
      desdeCanasta: desdePrev,
      hastaCanasta: hastaPrev,
      incluirPadre: false,
      linea: lineaCtx,
    });
  }

  const res = await imprimirEtiquetasDePesaje(doc, n, {
    ...opts,
    linea: lineaCtx,
    confirmar: true,
  });
  if (res && typeof res === "object" && res.ok) {
    pesaje.etiquetaDesde = res.desde;
    pesaje.etiquetaHasta = res.hasta;
  }
  return res;
};
