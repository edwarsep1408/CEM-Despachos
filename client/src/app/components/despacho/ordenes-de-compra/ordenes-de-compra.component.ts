import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../../material.module";
import { BodegasService } from "../../../services/bodegas/bodegas.service";
import { OrdenesCompraService } from "../../../services/despacho/ordenes-compra.service";
import { firstValueFrom } from "rxjs";
import Swal from "sweetalert2";

@Component({
  selector: "app-ordenes-de-compra",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: "./ordenes-de-compra.component.html",
  styleUrls: ["../despacho-page.css", "../cargues/cargues.component.css"],
})
export class OrdenesDeCompraComponent implements OnInit {
  cargando = true;
  importando = false;
  imprimiendo = false;
  filas: any[] = [];
  detalle: any = null;
  seleccion = new Set<string>();
  bodegas: { codigo: string; nombre: string }[] = [];
  bodegaOrigen = "";
  filtros = { estado: "aprobado", desde: "", hasta: "", q: "" };

  constructor(
    private oc: OrdenesCompraService,
    private bodegasService: BodegasService
  ) {}

  ngOnInit() {
    this.cargarBodegas();
    this.cargar();
  }

  get seleccionCount() {
    return this.seleccion.size;
  }

  cargar() {
    this.cargando = true;
    this.oc.listar(this.filtros).subscribe({
      next: (res) => {
        this.filas = res.body || [];
        const ids = new Set(this.filas.map((r) => String(r._id)));
        this.seleccion = new Set([...this.seleccion].filter((id) => ids.has(id)));
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer las OC");
      },
    });
  }

  toggle(row: any) {
    const id = String(row._id);
    const next = new Set(this.seleccion);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.seleccion = next;
  }

  seleccionarTodos() {
    this.seleccion = new Set(this.filas.map((r) => String(r._id)));
  }

  seleccionarNinguno() {
    this.seleccion = new Set();
  }

  onArchivo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivos = Array.from(input.files || []);
    input.value = "";
    if (!archivos.length) return;
    if (!this.bodegaOrigen) {
      this.toast("info", "Seleccione la bodega de origen antes de cargar el .hse");
      return;
    }
    const origen = this.bodegas.find((b) => b.codigo === this.bodegaOrigen);
    this.importando = true;
    void this.importarLote(archivos, origen?.nombre || "");
  }

  private async importarLote(archivos: File[], bodegaOrigenNombre: string) {
    let ok = 0;
    let conAvisos = 0;
    let ultimaOk: any = null;
    const errores: string[] = [];
    for (const archivo of archivos) {
      try {
        const res: any = await firstValueFrom(
          this.oc.importarHse({
            archivo,
            bodegaOrigen: this.bodegaOrigen,
            bodegaOrigenNombre,
          })
        );
        ok += 1;
        ultimaOk = res?.body || null;
        if (Number(res?.body?.lineasSinMatch || 0) > 0) conAvisos += 1;
      } catch (err: any) {
        errores.push(
          `${archivo.name}: ${err?.error?.body?.message || "No se pudo importar"}`
        );
      }
    }
    this.importando = false;
    this.filtros.estado = "aprobado";
    this.cargar();
    if (ultimaOk && archivos.length === 1) this.ver(ultimaOk);
    if (ok && !errores.length) {
      this.toast(
        conAvisos ? "info" : "success",
        conAvisos
          ? `${ok} orden(es) cargada(s); algunas tienen líneas sin ítem en catálogo`
          : `${ok} orden(es) de compra cargada(s)`
      );
      return;
    }
    if (ok && errores.length) {
      this.toast("info", `${ok} ok, ${errores.length} con error. Ej: ${errores[0]}`);
      return;
    }
    this.toast("error", errores[0] || "No se pudo importar el .hse");
  }

  ver(row: any) {
    if (!row?._id) {
      this.detalle = row;
      return;
    }
    this.oc.get(row._id).subscribe({
      next: (res) => (this.detalle = res.body),
      error: () => (this.detalle = row),
    });
  }

  anular(row: any) {
    Swal.fire({
      title: `¿Anular ${row.idEnc}?`,
      text: "Dejará de poder entrar a un cargue.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.oc.anular(row._id).subscribe({
        next: () => {
          this.toast("success", "Anulada.");
          if (this.detalle?._id === row._id) this.detalle = null;
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo anular"),
      });
    });
  }

  imprimirMarcados() {
    const filas = this.filas.filter((r) => this.seleccion.has(String(r._id)));
    if (!filas.length) {
      this.toast("info", "Marque al menos una orden de compra");
      return;
    }
    void this.imprimirOrdenes(filas);
  }

  imprimirTodos() {
    if (!this.filas.length) {
      this.toast("info", "No hay órdenes para imprimir");
      return;
    }
    void this.imprimirOrdenes(this.filas);
  }

  imprimirDetalle() {
    if (!this.detalle) return;
    void this.imprimirOrdenes([this.detalle]);
  }

  private async imprimirOrdenes(filas: any[]) {
    if (this.imprimiendo) return;
    this.imprimiendo = true;
    try {
      if (filas.length > 1) {
        const conf = await Swal.fire({
          title: `¿Imprimir ${filas.length} órdenes?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Imprimir",
          cancelButtonText: "Cancelar",
        });
        if (!conf.isConfirmed) return;
      }
      const detalles: any[] = [];
      for (const fila of filas) {
        if (fila.lineas?.length) {
          detalles.push(fila);
          continue;
        }
        const res = await firstValueFrom(this.oc.get(fila._id));
        detalles.push(res.body || fila);
      }
      this.abrirImpresion(detalles);
    } catch {
      this.toast("error", "No se pudieron cargar las órdenes para imprimir");
    } finally {
      this.imprimiendo = false;
    }
  }

  private abrirImpresion(detalles: any[]) {
    const logo = `${window.location.origin}/assets/img/LOGOTIPO.svg`;
    const hojas = detalles
      .map((oc, i) => this.htmlHojaOc(oc, logo, i + 1, detalles.length))
      .join("");
    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) {
      this.toast("error", "El navegador bloqueó la ventana de impresión");
      return;
    }
    ventana.document.write(`<!doctype html><html><head><title>Órdenes de compra · CEM-Despachos</title>
      <style>
        @page{size:A4;margin:12mm}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:16px}
        .hoja{page-break-after:always;position:relative;padding-bottom:32px;min-height:240mm}
        .hoja:last-child{page-break-after:auto}
        .logo{position:absolute;top:0;right:0;width:150px}
        h1{margin:0 0 4px;font-size:22px;font-weight:700;color:#0b3a6e}
        .sub{margin:0 0 12px;font-size:12px;color:#555}
        .meta{font-size:13px;line-height:1.45;max-width:72%}
        .meta b{display:inline-block;min-width:150px}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}
        th,td{border:1px solid #1d4f91;padding:5px 6px;text-align:left;vertical-align:top}
        th{background:#8ec3e6;color:#113}
        .num{text-align:right}
        .dash{text-align:center;color:#888}
        .footer{margin-top:10px;font-size:13px}
        .pie{position:absolute;bottom:0;left:0;right:0;font-size:11px;color:#444;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:6px}
      </style></head><body>${hojas}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 400);
  }

  private htmlHojaOc(oc: any, logo: string, pagina: number, totalPaginas: number) {
    const lineas = Array.isArray(oc.lineas) ? oc.lineas : [];
    const filas = lineas
      .map((linea: any) => {
        const undPed = linea.unidadPedidoEtiqueta || linea.unidadPedido || "UND";
        const cant = Number(linea.cantidad) || 0;
        const esKg = String(undPed).toUpperCase() === "KG";
        const und = esKg ? "" : this.fmt(cant);
        const kg = esKg ? this.fmt(cant) : linea.kilos ? this.fmt(linea.kilos) : "";
        return `<tr>
          <td>${this.esc(linea.referencia || linea.codigoItem || linea.ean)}</td>
          <td>${this.esc(linea.descripcion || "")}</td>
          <td class="num">${this.esc(und)}</td>
          <td class="num">${this.esc(kg)}</td>
          <td class="dash">----</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`;
      })
      .join("");
    const year = new Date().getFullYear();
    const tienda = oc.nombreEstablecimiento || "—";
    const razon = oc.razonSocial || "—";
    return `<section class="hoja">
      <img class="logo" src="${logo}" alt="Pollocoa" />
      <h1>Orden de compra</h1>
      <p class="sub">CEM-Despachos · Pollocoa</p>
      <div class="meta">
        <div><b>NUM ORDEN:</b> ${this.esc(oc.nroPedido || oc.idEnc)}</div>
        <div><b>ID INTERNO:</b> ${this.esc(oc.idEnc)} · ${this.esc(oc.idOc)}</div>
        <div><b>CLIENTE:</b> ${this.esc(razon)}</div>
        <div><b>ESTABLECIMIENTO:</b> ${this.esc(tienda)}</div>
        <div><b>LOCALIZACIÓN (GLN):</b> ${this.esc(oc.glnEntrega)}</div>
        <div><b>CÓDIGO TIENDA:</b> ${this.esc(oc.codigoEstablecimiento || "—")}</div>
        <div><b>BODEGA ORIGEN:</b> ${this.esc(oc.bodegaOrigen)} ${this.esc(oc.bodegaOrigenNombre || "")}</div>
        <div><b>FECHA:</b> ${this.esc(oc.fecha)}</div>
        <div><b>FECHA ENT. MIN:</b> ${this.esc(oc.fechaEntregaDesde || "—")}</div>
        <div><b>FECHA ENT. MAX:</b> ${this.esc(oc.fechaEntregaHasta || "—")}</div>
        <div><b>OBSERVACIÓN:</b> ${this.esc(oc.observacion || "—")}</div>
      </div>
      <table>
        <thead><tr>
          <th>CÓDIGO</th><th>REFERENCIA</th><th>UND</th><th>KG</th><th></th>
          <th>KG BRUTO</th><th>KG NETO</th><th>UNIDADES</th>
          <th>CANASTAS</th><th>BULTOS</th><th>CAJAS</th>
        </tr></thead>
        <tbody>${filas || `<tr><td colspan="11" class="dash">Sin líneas</td></tr>`}</tbody>
      </table>
      <div class="footer"><b>Total registros:</b> ${lineas.length}
        · <b>Valor:</b> ${this.fmtMoney(oc.valor)}
        · <b>UND pedido:</b> ${this.esc(oc.unidadesPedido || this.undsDe(lineas))}
      </div>
      <div class="pie">
        <span>${pagina}/${totalPaginas} · PDF generado con CEM-Despachos</span>
        <span>Pollocoa · ${year}</span>
      </div>
    </section>`;
  }

  private undsDe(lineas: any[]) {
    return [...new Set(lineas.map((l) => l.unidadPedidoEtiqueta || l.unidadPedido).filter(Boolean))].join(", ");
  }

  private fmt(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "");
    return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private fmtMoney(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  private esc(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private cargarBodegas() {
    this.bodegasService.onConsultarBodegas().subscribe({
      next: (res) => {
        const lista = (res.body || []).map((b: any) => ({
          codigo: String(b.codigo || "").trim(),
          nombre: String(b.nombre || b.descripcion || "").trim(),
        }));
        this.bodegas = lista.filter((b: any) => b.codigo).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.bodegasService.Get().subscribe({
          next: (res) => {
            this.bodegas = (res.body || [])
              .map((b: any) => ({ codigo: String(b.codigo || "").trim(), nombre: String(b.nombre || "").trim() }))
              .filter((b: any) => b.codigo);
          },
        });
      },
    });
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3500 });
  }
}
