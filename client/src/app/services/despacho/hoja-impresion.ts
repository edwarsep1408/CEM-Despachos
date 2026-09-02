export type ImpresionHoja = {
  planta: {
    codigo: string;
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    celular: string;
    auxiliar: string;
    supervisor: string;
  };
  hoja: {
    idHoja?: string | number;
    nombre?: string;
    fecha?: string;
    conductor?: string;
    placa?: string;
    telefono?: string;
    capacidad?: string | number;
    pesoAdicional?: string | number;
    temperatura?: string;
    canastas?: string | number;
    bultos?: string | number;
    supervisor?: string;
    despachador?: string;
    telDistribucion?: string;
    facturador?: string;
    celularPtoContacto?: string;
    auxiliar?: string;
    canastasIfco?: string;
    transportadora?: string;
    observaciones?: string;
    usuario?: string;
  };
  filas: Array<{
    nroDoc?: string;
    sucursal?: string;
    cliente?: string;
    direccion?: string;
    barrio?: string;
    municipio?: string;
    peso?: number;
    destareTxt?: string;
    contado?: number;
    credito?: number;
  }>;
  certificados: Array<{
    numero: string;
    fechaExpedicion: string;
    fechaDespacho: string;
    horaDespacho: string;
    cliente: string;
    direccion: string;
    municipio: string;
    observaciones: string;
    placa: string;
    temperaturaVehiculo: string;
    lineas: Array<{
      producto?: string;
      concepto?: string;
      especie?: string;
      unid?: number;
      peso?: number;
      lote?: string;
      fechaBeneficio?: string;
      vence?: string;
      temperatura?: string;
      observaciones?: string;
    }>;
    firmanteCalidad?: { nombre?: string; cargoEtiqueta?: string; firma?: string } | null;
    firmanteLogistica?: { nombre?: string; cargoEtiqueta?: string; firma?: string } | null;
  }>;
  totales: {
    valor?: number;
    peso?: number;
    destare?: number;
    bruto?: number;
    contado?: number;
    credito?: number;
    ocupacion?: number;
    clientes?: number;
    facturas?: number;
    salidas?: number;
    transferencias?: number;
  };
};

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !n) return n === 0 ? "0" : "";
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
};

const kg = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-CO", { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 });
};

const dato = (label: string, value: unknown) =>
  `<div><b>${esc(label)}:</b> ${esc(value ?? "")}</div>`;

const cssComun = `
  @page{margin:10mm}
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:11px}
  .page{page-break-after:always;padding:4px 2px 18px}
  .page:last-child{page-break-after:auto}
  h1{margin:0 0 6px;font-size:20px}
  h2{margin:0 0 8px;font-size:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #1d4f91;padding:3px 4px;vertical-align:top}
  th{background:#8ec3e6;font-size:10px;text-align:left}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;line-height:1.35}
  .meta.one{grid-template-columns:1fr}
  .right{text-align:right}
  .muted{color:#444}
`;

const cssRutero = `
  ${cssComun}
  h1{font-size:22px}
  .meta{grid-template-columns:1fr 1fr 1fr}
  table{font-size:10px}
  .totales{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;font-size:12px}
  .firma{margin-top:18px}
`;

const cssCert = `
  ${cssComun}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
  .marca{font-weight:700;font-size:13px;line-height:1.2;max-width:160px}
  .titulo{text-align:center;flex:1}
  .titulo h1{font-size:18px;margin:0}
  .num{font-size:13px;margin-top:4px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}
  .bloque b{display:inline-block;min-width:130px}
  table{font-size:10px}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;text-align:center}
  .firmas .sello{height:52px;max-width:180px;display:block;margin:0 auto 2px;object-fit:contain}
  .firmas .sello-vacio{height:52px}
  .firmas .linea{border-top:1px solid #111;margin:8px 18px 4px;padding-top:4px}
  .cierre{margin-top:22px;font-size:12px}
  .cierre div{margin:6px 0}
`;

const documentoCompleto = (titulo: string, html: string, css: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${css}</style></head><body>${html}</body></html>`;

export const abrirVentanaImpresion = (mensaje = "Generando PDF…") => {
  const ventana = window.open("about:blank", "_blank", "width=980,height=720");
  if (!ventana) return null;
  ventana.document.open();
  ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PDF</title></head>
    <body style="font-family:Arial,sans-serif;padding:24px;color:#333">${esc(mensaje)}</body></html>`);
  ventana.document.close();
  return ventana;
};

const escribirYImprimir = (ventana: Window, titulo: string, html: string, css: string) => {
  ventana.document.open();
  ventana.document.write(documentoCompleto(titulo, html, css));
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 400);
};

const imprimirEnIframe = (titulo: string, html: string, css: string) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(documentoCompleto(titulo, html, css));
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
  }, 400);
  return true;
};

export const llenarImpresion = (
  ventana: Window | null,
  titulo: string,
  html: string,
  css: string
) => {
  if (ventana && !ventana.closed) {
    escribirYImprimir(ventana, titulo, html, css);
    return true;
  }
  return imprimirEnIframe(titulo, html, css);
};

export const imprimirRutero = (data: ImpresionHoja, ventana: Window | null = null) =>
  llenarImpresion(ventana, `Hoja de ruta ${data.hoja?.idHoja || ""}`, htmlRutero(data), cssRutero);

export const imprimirCertificados = (data: ImpresionHoja, ventana: Window | null = null) =>
  llenarImpresion(
    ventana,
    `Certificados ${data.hoja?.idHoja || ""}`,
    htmlCertificados(data),
    cssCert
  );

export const htmlRutero = (data: ImpresionHoja) => {
  const h = data.hoja || {};
  const t = data.totales || {};
  const filas = (data.filas || [])
    .map(
      (row) => `<tr>
        <td>${esc(row.nroDoc)}</td>
        <td>${esc(row.sucursal)}</td>
        <td>${esc(row.cliente)}</td>
        <td>${esc(row.direccion)}</td>
        <td>${esc(row.barrio)}</td>
        <td>${esc(row.municipio)}</td>
        <td class="right">${esc(kg(row.peso))}</td>
        <td>${esc(row.destareTxt)}</td>
        <td class="right">${esc(money(row.contado))}</td>
        <td class="right">${esc(money(row.credito))}</td>
      </tr>`
    )
    .join("");
  return `<section class="page">
    <h1>Hoja de ruta</h1>
    <div class="meta">
      ${dato("ID_RUTA", h.idHoja)}
      ${dato("NOMBRE_RUTA", h.nombre)}
      ${dato("FECHA", h.fecha)}
      ${dato("CONDUCTOR", h.conductor)}
      ${dato("PLACA", h.placa)}
      ${dato("TELEFONO", h.telefono)}
      ${dato("CAPACIDAD", h.capacidad ? `${h.capacidad} t` : "")}
      ${dato("PESO ADICIONAL", h.pesoAdicional)}
      ${dato("TEMPERATURA", h.temperatura)}
      ${dato("CANASTA", h.canastas)}
      ${dato("BULTOS", h.bultos)}
      ${dato("SUPERVISOR", h.supervisor)}
      ${dato("DESPACHADOR", h.despachador)}
      ${dato("TEL_DISTRIBUCION", h.telDistribucion)}
      ${dato("FACTURADOR", h.facturador)}
      ${dato("CELULAR_PTO_CONTACTO", h.celularPtoContacto)}
      ${dato("AUXILIAR", h.auxiliar)}
      ${dato("CANASTAS_IFCO", h.canastasIfco)}
      ${dato("TRANSPORTADORA", h.transportadora)}
      ${dato("OBSERVACIONES", h.observaciones)}
      ${dato("OCUPACION", t.ocupacion ? `${t.ocupacion}%` : "")}
      ${dato("CLIENTES", t.clientes)}
      ${dato("FACTURAS", t.facturas)}
      ${dato("SALIDAS", t.salidas)}
      ${dato("TRANSFERENCIAS", t.transferencias)}
    </div>
    <table>
      <thead><tr>
        <th>NRO_DOC</th><th>SUCURSAL</th><th>CLIENTE</th><th>DIRECCION</th>
        <th>BARRIO</th><th>MUNICIPIO</th><th>PESO</th><th>DET_TARA</th>
        <th>CONTADO</th><th>CREDITO</th>
      </tr></thead>
      <tbody>${filas || `<tr><td colspan="10">Sin documentos en la hoja.</td></tr>`}</tbody>
    </table>
    <div class="totales">
      <div><b>VALOR:</b> ${esc(money(t.valor))}</div>
      <div><b>PESO:</b> ${esc(kg(t.peso))}</div>
      <div><b>CONTADO:</b> ${esc(money(t.contado))}</div>
      <div><b>CREDITO:</b> ${esc(money(t.credito))}</div>
      <div><b>TOTAL BRUTO:</b> ${esc(kg(t.bruto))}</div>
      <div><b>DESTARE:</b> ${esc(kg(t.destare))}</div>
    </div>
    <div class="firma"><b>USUARIO:</b> ${esc(h.usuario)} ________________</div>
  </section>`;
};

const srcFirma = (raw?: string) => {
  const s = String(raw || "").trim();
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(s) ? s : "";
};

const bloqueFirma = (
  firmante: { nombre?: string; cargoEtiqueta?: string; firma?: string } | null | undefined,
  fallbackNombre: string,
  cargo: string
) => {
  const nombre = firmante?.nombre || fallbackNombre;
  const etiqueta = firmante?.cargoEtiqueta || cargo;
  const src = srcFirma(firmante?.firma);
  const sello = src ? `<img class="sello" src="${src}" alt="" />` : `<div class="sello-vacio"></div>`;
  return `<div>${sello}<div class="linea">${esc(nombre)}<br/>${esc(etiqueta)}</div></div>`;
};

export const htmlCertificados = (data: ImpresionHoja) => {
  const p = data.planta || ({} as ImpresionHoja["planta"]);
  const certs = data.certificados || [];
  if (!certs.length) {
    return `<section class="page"><h1>Certificado de calidad</h1><p>Esta hoja aún no tiene facturas.</p></section>`;
  }
  return certs
    .map((c) => {
      const filas = (c.lineas || [])
        .map(
          (linea) => `<tr>
            <td>${esc(linea.producto)}</td>
            <td>${esc(linea.concepto)}</td>
            <td>${esc(linea.especie)}</td>
            <td class="right">${esc(kg(linea.unid))}</td>
            <td class="right">${esc(kg(linea.peso))}</td>
            <td>${esc(linea.lote)}</td>
            <td>${esc(linea.fechaBeneficio)}</td>
            <td>${esc(linea.vence)}</td>
            <td class="right">${esc(linea.temperatura)}</td>
            <td>${esc(linea.observaciones)}</td>
          </tr>`
        )
        .join("");
      return `<section class="page">
        <div class="head">
          <div class="marca">${esc(p.nombre)}</div>
          <div class="titulo">
            <h1>Certificado de calidad<br/>y Guia de transporte</h1>
            <div class="num"># ${esc(c.numero)}</div>
          </div>
        </div>
        <div class="cols">
          <div class="bloque">
            <div><b>Fecha de Expedicion:</b> ${esc(c.fechaExpedicion)}</div>
            <div><b>Fecha de Despacho:</b> ${esc(c.fechaDespacho)}</div>
            <div><b>Hora de Despacho:</b> ${esc(c.horaDespacho)}</div>
            <div><b>Cliente:</b> ${esc(c.cliente)}</div>
            <div><b>Direccion:</b> ${esc(c.direccion)}</div>
            <div>${esc(c.municipio)}</div>
            <div><b>Observaciones:</b> ${esc(c.observaciones)}</div>
          </div>
          <div class="bloque">
            <div><b>Codigo Planta:</b> ${esc(p.codigo)}</div>
            <div>${esc(p.direccion)}</div>
            <div>${esc(p.ciudad)}</div>
            <div><b>Telefono:</b> ${esc(p.telefono)}</div>
            <div><b>Celular:</b> ${esc(p.celular)}</div>
            <div>Destino Nacional</div>
          </div>
        </div>
        <h2>Referente al Producto</h2>
        <table>
          <thead><tr>
            <th>PRODUCTO</th><th>CONCEPTO</th><th>ESPECIE</th><th>UNID.</th><th>PESO</th>
            <th>LOTE</th><th>FECHA BENEFICIO</th><th>VENCE</th><th>TEMPERATURA</th><th>OBSERVACIONES</th>
          </tr></thead>
          <tbody>${filas || `<tr><td colspan="10">Sin líneas de producto. La factura no trae ítems; agregue el pedido despachado del cargue (o sincronice el pedido) para lote, peso y vencimiento.</td></tr>`}</tbody>
        </table>
        <p><b>Placa del vehículo:</b> ${esc(c.placa)}</p>
        <p><b>Temperatura del vehículo:</b> ${esc(c.temperaturaVehiculo)}${c.temperaturaVehiculo ? "ºC" : ""}</p>
        <div class="firmas">
          ${bloqueFirma(c.firmanteCalidad, p.auxiliar, "AUXILIAR DE CALIDAD")}
          ${bloqueFirma(c.firmanteLogistica, p.supervisor, "SUPERVISOR DE LOGISTICA")}
        </div>
        <div class="cierre">
          <div><b>CIERRE DE LA GUIA</b></div>
          <div>FECHA DE ENTREGA:_______________________</div>
          <div>HORA DE ENTREGA:________________________</div>
        </div>
      </section>`;
    })
    .join("");
};
