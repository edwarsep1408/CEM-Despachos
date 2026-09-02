import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { PisoService } from "../../services/despacho/piso.service";
import { MotivosOmisionService } from "../../services/despacho/motivos-omision.service";
import { documentoListoParaEtiquetas, pedirYImprimirEtiquetas } from "../../services/despacho/etiquetas-cargue";
import { PisoBrandComponent } from "./piso-brand.component";
import { atajoBloqueado, confirmarRepesar, documentoCerrado, etiquetaCargue, mensajeApi, pedirMotivoOmision } from "./piso-ui";
import { etiquetaPedido } from "../../core/etiqueta-docto";
import Swal from "sweetalert2";

@Component({
  selector: "app-portal-documentos",
  standalone: true,
  imports: [CommonModule, RouterModule, PisoBrandComponent],
  templateUrl: "./portal-documentos.component.html",
  styleUrl: "./piso-portal.css",
})
export class PortalDocumentosComponent implements OnInit {
  cargueId = "";
  idCargue: number | string = "";
  bodega = "";
  documentos: any[] = [];
  sel = 0;
  error = "";
  cargando = true;
  etiquetaCargue = etiquetaCargue;
  etiquetaPedido = etiquetaPedido;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private piso: PisoService,
    private motivos: MotivosOmisionService
  ) {}

  ngOnInit(): void {
    this.cargueId = this.route.snapshot.paramMap.get("cargueId") || "";
    this.cargar();
  }

  cargar() {
    this.piso.getCargue(this.cargueId).subscribe({
      next: (res) => {
        const body = res?.body || {};
        this.idCargue = body.idCargue;
        this.bodega = body.bodega || "";
        this.documentos = body.documentos || [];
        this.cargando = false;
        if (this.sel >= this.documentos.length) this.sel = 0;
      },
      error: (err) => {
        this.error = mensajeApi(err, "No se pudo leer el cargue.");
        this.cargando = false;
      },
    });
  }

  volver() {
    this.router.navigate(["/portal-despachador"]);
  }

  listoParaEtiquetas(row: any) {
    return documentoListoParaEtiquetas(row);
  }

  async imprimirEtiquetas(row: any, ev?: Event) {
    ev?.stopPropagation();
    await pedirYImprimirEtiquetas(row, {
      cargueId: this.cargueId,
      registrar: (payload) => this.piso.registrarEtiquetas(payload),
    });
  }

  abrir(row?: any) {
    const doc = row || this.documentos[this.sel];
    if (!doc?._id) return;
    this.router.navigate(["/portal-despachador", this.cargueId, doc._id]);
  }

  puedeRepesar(row: any) {
    return !!row && documentoCerrado(row);
  }

  async repesar(row?: any, ev?: Event) {
    ev?.stopPropagation();
    const doc = row || this.documentos[this.sel];
    if (!this.puedeRepesar(doc)) return;
    const omitido = !!doc.omitido || String(doc.estadoDespacho || "").toUpperCase() === "OMIT";
    const ok = await confirmarRepesar(
      omitido
        ? "El documento omitido volverá a pendiente para poder pesar de nuevo."
        : "El documento volverá a pendiente para poder pesar de nuevo."
    );
    if (!ok) return;
    this.piso.repesar({ cargueId: this.cargueId, docId: doc._id }).subscribe({
      next: () => this.cargar(),
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo reabrir el documento.") }),
    });
  }

  async omitir(row: any, ev?: Event) {
    ev?.stopPropagation();
    if (!row || row.omitido) return;
    const motivo = await pedirMotivoOmision(this.motivos);
    if (!motivo) return;
    this.piso.omitirDocumento({ cargueId: this.cargueId, docId: row._id, motivo }).subscribe({
      next: () => this.cargar(),
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo omitir.") }),
    });
  }

  @HostListener("window:keydown", ["$event"])
  onKey(ev: KeyboardEvent) {
    if (atajoBloqueado(ev)) return;
    if (ev.key === "F10") {
      ev.preventDefault();
      this.volver();
      return;
    }
    if (!this.documentos.length) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.sel = Math.min(this.sel + 1, this.documentos.length - 1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.sel = Math.max(this.sel - 1, 0);
    } else     if (ev.key === "Enter") {
      ev.preventDefault();
      this.abrir();
    } else if (ev.key === "r" || ev.key === "R") {
      ev.preventDefault();
      void this.repesar();
    }
  }
}
