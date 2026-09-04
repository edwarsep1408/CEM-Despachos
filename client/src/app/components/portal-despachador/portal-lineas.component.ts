import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { PisoService } from "../../services/despacho/piso.service";
import { MotivosOmisionService } from "../../services/despacho/motivos-omision.service";
import {
  contarCanastas,
  documentoListoParaEtiquetas,
  pedirYImprimirEtiquetas,
} from "../../services/despacho/etiquetas-cargue";
import { PisoBrandComponent } from "./piso-brand.component";
import {
  atajoBloqueado,
  avancePedido,
  AvancePedido,
  confirmarDesbalance,
  confirmarRepesar,
  documentoCerrado,
  documentoDespachado,
  documentoOmitido,
  etiquetaCargue,
  lineaOmitida,
  mensajeApi,
  pedirMotivoOmision,
  pedidoEnDe,
} from "./piso-ui";

type AlertaDesbalance = { linea: { producto?: string }; av: AvancePedido };
import { etiquetaPedido } from "../../core/etiqueta-docto";
import Swal from "sweetalert2";

@Component({
  selector: "app-portal-lineas",
  standalone: true,
  imports: [CommonModule, RouterModule, PisoBrandComponent],
  templateUrl: "./portal-lineas.component.html",
  styleUrl: "./piso-portal.css",
})
export class PortalLineasComponent implements OnInit {
  cargueId = "";
  docId = "";
  doc: any = null;
  sel = 0;
  error = "";
  cargando = true;
  etiquetaCargue = etiquetaCargue;
  etiquetaPedido = etiquetaPedido;
  pedidoEnDe = pedidoEnDe;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private piso: PisoService,
    private motivos: MotivosOmisionService
  ) {}

  ngOnInit(): void {
    this.cargueId = this.route.snapshot.paramMap.get("cargueId") || "";
    this.docId = this.route.snapshot.paramMap.get("docId") || "";
    this.cargar();
  }

  get lineas() {
    return this.doc?.lineas || [];
  }

  get listoParaEtiquetas() {
    return documentoListoParaEtiquetas(this.doc);
  }

  get canastas() {
    return contarCanastas(this.doc);
  }

  get docCerrado() {
    return documentoCerrado(this.doc);
  }

  puedeRepesarLinea(row: any) {
    if (!row) return false;
    if (lineaOmitida(row)) return true;
    if (documentoOmitido(this.doc) && !documentoDespachado(this.doc)) return false;
    return (
      documentoDespachado(this.doc) ||
      String(row.estadoDespacho || "").toUpperCase() === "DESP" ||
      Number(row.cd) > 0 ||
      Number(row.pd) > 0
    );
  }

  cargar() {
    this.piso.getCargue(this.cargueId).subscribe({
      next: (res) => {
        const docs = res?.body?.documentos || [];
        this.doc = docs.find((d: any) => String(d._id) === this.docId) || null;
        if (this.doc) {
          this.doc.idCargue = res.body.idCargue;
          this.doc.bodega = res.body.bodega || "";
        }
        this.cargando = false;
        if (this.sel >= this.lineas.length) this.sel = 0;
      },
      error: (err) => {
        this.error = mensajeApi(err, "No se pudo leer el documento.");
        this.cargando = false;
      },
    });
  }

  volver() {
    this.router.navigate(["/portal-despachador", this.cargueId]);
  }

  pesar(row?: any) {
    const linea = row || this.lineas[this.sel];
    if (!linea || linea.omitido || this.docCerrado) return;
    this.router.navigate(["/portal-despachador", this.cargueId, this.docId, linea.idLinea]);
  }

  async repesarDocumento() {
    if (!this.docCerrado) return;
    const omitido = !!this.doc?.omitido || String(this.doc?.estadoDespacho || "").toUpperCase() === "OMIT";
    const ok = await confirmarRepesar(
      omitido
        ? "El documento omitido volverá a pendiente para poder pesar de nuevo."
        : "El documento volverá a pendiente para poder pesar de nuevo."
    );
    if (!ok) return;
    this.piso.repesar({ cargueId: this.cargueId, docId: this.docId }).subscribe({
      next: (res) => {
        this.doc = { ...this.doc, ...(res?.body || {}) };
      },
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo reabrir el documento.") }),
    });
  }

  async repesarLinea(row?: any, ev?: Event) {
    ev?.stopPropagation();
    const linea = row || this.lineas[this.sel];
    if (!this.puedeRepesarLinea(linea)) return;
    const ok = await confirmarRepesar(
      lineaOmitida(linea)
        ? "El producto omitido volverá a pendiente para poder pesarlo."
        : "Se quitarán los pesajes de este producto para volver a pesarlo."
    );
    if (!ok) return;
    this.piso.repesar({ cargueId: this.cargueId, docId: this.docId, lineaId: linea.idLinea }).subscribe({
      next: (res) => {
        this.doc = { ...this.doc, ...(res?.body || {}) };
      },
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo volver a pesar.") }),
    });
  }

  async omitir(row: any, ev?: Event) {
    ev?.stopPropagation();
    if (!row || row.omitido) return;
    const motivo = await pedirMotivoOmision(this.motivos);
    if (!motivo) return;
    this.piso
      .omitirLinea({ cargueId: this.cargueId, docId: this.docId, lineaId: row.idLinea, motivo })
      .subscribe({
        next: (res) => {
          this.doc = { ...this.doc, ...(res?.body || {}) };
        },
        error: (err) =>
          Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo omitir.") }),
      });
  }

  async imprimirEtiquetas() {
    await pedirYImprimirEtiquetas(this.doc, {
      cargueId: this.cargueId,
      registrar: (payload) => this.piso.registrarEtiquetas(payload),
    });
  }

  async finalizar() {
    if (this.docCerrado) return;
    const conAvance: AlertaDesbalance[] = (this.lineas || [])
      .filter((l: any) => !lineaOmitida(l))
      .map((l: any): AlertaDesbalance => ({ linea: l, av: avancePedido(l) }));
    const alertas = conAvance.filter(
      ({ av }) => av.estado === "falta" || av.estado === "exceso"
    );
    let forzar = false;
    if (alertas.length) {
      const detalle = alertas
        .map(({ linea, av }) => `${linea.producto}: ${av.etiqueta} (${av.pct.toFixed(0)}%)`)
        .join("\n");
      const hayExceso = alertas.some(({ av }) => av.estado === "exceso");
      const hayFalta = alertas.some(({ av }) => av.estado === "falta");
      const ok = await confirmarDesbalance({
        estado: hayExceso && !hayFalta ? "exceso" : "falta",
        etiqueta: hayExceso && hayFalta ? "Falta y exceso" : hayExceso ? "Se pasó" : "Falta",
        detalle: `${detalle}\n¿Confirma finalizar igual?`,
        accion: "Finalizar",
      });
      if (!ok) return;
      forzar = true;
    }
    this.piso.finalizarDocumento({ cargueId: this.cargueId, docId: this.docId, forzar }).subscribe({
      next: async () => {
        const r = await Swal.fire({
          icon: "success",
          title: "Documento finalizado",
          text: "¿Imprimir etiquetas de canasta?",
          showCancelButton: true,
          confirmButtonText: "Imprimir",
          cancelButtonText: "Ahora no",
        });
        if (r.isConfirmed) await this.imprimirEtiquetas();
        this.volver();
      },
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo finalizar.") }),
    });
  }

  @HostListener("window:keydown", ["$event"])
  onKey(ev: KeyboardEvent) {
    if (atajoBloqueado(ev)) return;
    const k = ev.key;
    if (k === "F10") {
      ev.preventDefault();
      this.volver();
      return;
    }
    if (k === "f" || k === "F") {
      ev.preventDefault();
      if (!this.docCerrado) void this.finalizar();
      return;
    }
    if (k === "r" || k === "R") {
      ev.preventDefault();
      if (this.docCerrado) void this.repesarDocumento();
      else void this.repesarLinea();
      return;
    }
    if (k === "e" || k === "E") {
      ev.preventDefault();
      void this.imprimirEtiquetas();
      return;
    }
    if (!this.lineas.length) return;
    if (k === "ArrowDown") {
      ev.preventDefault();
      this.sel = Math.min(this.sel + 1, this.lineas.length - 1);
    } else if (k === "ArrowUp") {
      ev.preventDefault();
      this.sel = Math.max(this.sel - 1, 0);
    } else if (k === "Enter") {
      ev.preventDefault();
      this.pesar();
    }
  }
}
