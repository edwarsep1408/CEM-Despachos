import { firstValueFrom, Observable } from "rxjs";
import Swal from "sweetalert2";
import { abrirVentanaImpresion, llenarImpresion } from "./hoja-impresion";
import { qrSvg } from "./qr-svg";
import { cargarBitmapPollocoa, descargarPrn, tsplBanderinHija } from "./etiquetas-tspl";

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

export const contarCanastas = (doc: any = {}) => {
  let n = 0;
  for (const linea of doc.lineas || []) {
    for (const p of linea.pesajes || []) {
      const det = p.taraDetalle && typeof p.taraDetalle === "object" ? p.taraDetalle : {};
      for (const nombre of Object.keys(det)) {
        if (!/CANAST/i.test(nombre)) continue;
        n += Number(det[nombre]) || 0;
      }
    }
  }
  return n;
};

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

export const armarEtiquetasCanasta = (
  doc: any = {},
  totalCanastas: number,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = []
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
`;

const logoPollocoa = () =>
  `${typeof location !== "undefined" ? location.origin : ""}/assets/pollocoa-banderin.png`;

const htmlEtiqueta = (e: EtiquetaCanasta) => `<section class="etiq">
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

export const imprimirEtiquetasCanasta = (
  doc: any,
  totalCanastas: number,
  ventana: Window | null = null,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = []
) => {
  const etiquetas = armarEtiquetasCanasta(doc, totalCanastas, registradas);
  if (!etiquetas.length) return false;
  const html = etiquetas.map(htmlEtiqueta).join("");
  void descargarTsplBanderines(etiquetas);
  return llenarImpresion(
    ventana,
    `Etiquetas ${etiquetas[0].documentoRef}`,
    html,
    cssEtiquetas
  );
};

const descargarTsplBanderines = async (etiquetas: EtiquetaCanasta[]) => {
  try {
    const bitmap = await cargarBitmapPollocoa();
    const jobs = etiquetas.map((e) =>
      tsplBanderinHija(
        {
          productLongName: e.cliente || "SIN CLIENTE",
          referencia: e.documentoRef,
          loadName: e.loadName,
          stateProduct: e.stateProduct,
          consecutive: e.codigo,
          enterpriseClientName: e.cliente || "SIN CLIENTE",
          barcode: e.codigo,
        },
        bitmap
      )
    );
    const total = jobs.reduce((n, j) => n + j.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const j of jobs) {
      out.set(j, o);
      o += j.length;
    }
    descargarPrn(`${etiquetas[0].documentoRef}-banderin.prn`, out);
  } catch (err) {
    console.error("No se pudo armar el TSPL del banderín:", err);
  }
};

export const abrirImpresionEtiquetas = (
  doc: any,
  totalCanastas: number,
  registradas: Array<{ codigo?: string; canastaNum?: number }> = []
) => {
  const ventana = abrirVentanaImpresion("Generando etiquetas…");
  return imprimirEtiquetasCanasta(doc, totalCanastas, ventana, registradas);
};

export const pedirYImprimirEtiquetas = async (
  doc: any,
  opts: {
    cargueId: string;
    registrar: (payload: { cargueId: string; docId: string; totalCanastas: number }) => Observable<any>;
  }
) => {
  if (!doc || !documentoListoParaEtiquetas(doc)) {
    await Swal.fire({
      icon: "info",
      title: "Termine de pesar el documento para imprimir etiquetas.",
    });
    return false;
  }
  const canastas = contarCanastas(doc);
  const r = await Swal.fire({
    title: "Etiquetas de canasta",
    text: canastas
      ? `Se imprimirá 1 banderín por canasta (${canastas}) para la TSC MH241T (304 × 60 mm).`
      : "No hay canastas en los pesajes. Indique cuántas etiquetas imprimir.",
    input: "number",
    inputValue: canastas || 1,
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
    if (res?.body?.documento) {
      Object.assign(doc, res.body.documento);
    }
    return abrirImpresionEtiquetas(doc, total, registradas);
  } catch (err: any) {
    await Swal.fire({
      icon: "error",
      title: err?.error?.body?.message || err?.message || "No se pudieron registrar las etiquetas.",
    });
    return false;
  }
};
