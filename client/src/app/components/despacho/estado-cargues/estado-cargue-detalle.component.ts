import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { CarguesService } from "../../../services/despacho/cargues.service";
import { etiquetaPedido } from "../../../core/etiqueta-docto";
import Swal from "sweetalert2";

@Component({
  selector: "app-estado-cargue-detalle",
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: "./estado-cargue-detalle.component.html",
  styleUrls: ["../despacho-page.css", "./estado-cargues.component.css"],
})
export class EstadoCargueDetalleComponent implements OnInit {
  cargando = true;
  cargue: any = null;
  docSel: any = null;
  etiquetaPedido = etiquetaPedido;

  constructor(private route: ActivatedRoute, private cargues: CarguesService) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    const id = this.route.snapshot.paramMap.get("id") || "";
    this.cargando = true;
    this.cargues.getEstadoCargue(id).subscribe({
      next: (res) => {
        const selId = this.docSel?._id;
        this.cargue = res.body;
        this.docSel =
          (this.cargue?.documentos || []).find((d: any) => d._id === selId) ||
          this.cargue?.documentos?.[0] ||
          null;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire({
          toast: true,
          position: "top",
          icon: "error",
          title: err?.error?.body?.message || "No se pudo leer el cargue",
          showConfirmButton: false,
          timer: 3000,
        });
      },
    });
  }

  async devolver() {
    if (!this.cargue?._id || this.cargue.estado !== "COMPLETADO") return;
    const r = await Swal.fire({
      title: "Devolver a despachos",
      text: `El cargue ${this.cargue.idCargue} volverá al portal del despachador para poder pesarlo otra vez. Los pesajes actuales se conservan.`,
      showCancelButton: true,
      confirmButtonText: "Devolver",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    this.cargues.devolverADespachos(this.cargue._id).subscribe({
      next: (res) => {
        this.cargue = res.body;
        this.docSel = this.cargue?.documentos?.[0] || null;
        Swal.fire({
          toast: true,
          position: "top",
          icon: "success",
          title: "Cargue devuelto a despachos",
          showConfirmButton: false,
          timer: 2500,
        });
      },
      error: (err) =>
        Swal.fire({
          icon: "error",
          title: err?.error?.body?.message || "No se pudo devolver el cargue",
        }),
    });
  }

  etiqueta(estado: string) {
    if (estado === "COMPLETADO") return "Completado";
    if (estado === "DESP") return "Despachado";
    if (estado === "EN_PROCESO" || estado === "PROCESO") return "En proceso";
    if (estado === "OMIT") return "Omitido";
    if (estado === "EN_PISO") return "En piso";
    return "Pendiente";
  }
}
